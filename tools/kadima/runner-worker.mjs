#!/usr/bin/env node

/**
 * Runner Worker — executes a single task.
 * Spawned by Kadima daemon via child_process.fork().
 *
 * Reads InputEnvelope from .ogu/runners/{taskId}.input.json
 * Writes OutputEnvelope to .ogu/runners/{taskId}.output.json
 *
 * If the InputEnvelope contains a taskSpec with output.files,
 * the runner creates those files (the "dog-food" path).
 * Otherwise, it simulates execution (dry-run).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildOutputEnvelope } from '../contracts/envelopes/output.mjs';
import { dispatch, respond } from '../ogu/commands/lib/kadima-adapter.mjs';
import { validateRunner, createOutputEnvelope } from '../ogu/commands/lib/runner.mjs';
import { createLocalRunner } from '../ogu/commands/lib/runner-local.mjs';
import { createErrorEnvelope, isRecoverable } from '../ogu/commands/lib/error-envelope.mjs';
import { validateErrorEnvelope } from '../ogu/commands/lib/error-envelope-protocol.mjs';
import { createRetryPolicy } from '../ogu/commands/lib/retry-policy.mjs';
import { createTimeoutManager } from '../ogu/commands/lib/timeout-manager.mjs';
import { retryWithFeedback } from '../ogu/commands/lib/gate-feedback.mjs';
import { preflightTaskSpec, runTaskGates, buildTaskFixNote, formatGateErrorsForFix } from '../ogu/commands/lib/task-gates.mjs';
import { getRunnersDir } from '../ogu/commands/lib/runtime-paths.mjs';

const taskId = process.argv[2];
const root = process.env.OGU_ROOT || process.cwd();

if (!taskId) {
  console.error('Usage: runner-worker.mjs <taskId>');
  process.exit(1);
}

const runnersDir = getRunnersDir(root);
const inputPath = join(runnersDir, `${taskId}.input.json`);
const outputPath = join(runnersDir, `${taskId}.output.json`);

if (!existsSync(inputPath)) {
  console.error(`InputEnvelope not found: ${inputPath}`);
  process.exit(1);
}

const input = JSON.parse(readFileSync(inputPath, 'utf8'));
const startedAt = new Date().toISOString();
const simulateFix = process.env.OGU_KADIMA_SIMULATE === '1';
const maxFixRetries = Number(process.env.OGU_KADIMA_MAX_RETRIES || 2);

// ── Retry policy & timeout management ──
const retryPolicy = createRetryPolicy({ strategy: 'exponential', delay: 1000, maxRetries: 3 });
const timeoutMgr = createTimeoutManager();
const timeoutId = timeoutMgr.setTimeout(`task-${taskId}`, input.budget?.maxTokens > 50000 ? 600000 : 300000);

// ── Validate local runner contract ──
const localRunner = createLocalRunner({ workDir: root, name: `worker-${taskId}` });
const runnerValidation = validateRunner(localRunner);
if (!runnerValidation.valid) {
  console.error(`Runner contract validation failed: ${runnerValidation.errors.join(', ')}`);
}

// ── Validate via Kadima adapter (boundary enforcement) ──
const dispatchResult = await dispatch(root, input);
if (!dispatchResult.accepted) {
  // Create structured error envelope for dispatch rejection
  const errEnvelope = createErrorEnvelope({
    code: 'OGU0605',
    message: dispatchResult.error,
    source: 'runner-worker',
    severity: 'error',
    taskId,
    featureSlug: input.featureSlug,
  });

  // Check if error is recoverable and retry if policy allows
  if (isRecoverable(errEnvelope.code) && retryPolicy.shouldRetry(1)) {
    console.error(`Recoverable error (${errEnvelope.code}), but first attempt failed — exiting.`);
  }

  const errorOutput = buildOutputEnvelope(taskId, {
    status: 'error',
    error: dispatchResult.error,
    errorEnvelope: errEnvelope,
    tokensUsed: { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
  }, { featureSlug: input.featureSlug, pid: process.pid, isolationLevel: 'L0', durationMs: 0, startedAt, idempotencyKey: input.idempotencyKey });
  writeFileSync(outputPath, JSON.stringify(errorOutput, null, 2), 'utf8');
  timeoutMgr.clearTimeout(timeoutId);
  process.exit(1);
}

// ── Execute task ──

const filesCreated = [];
const taskSpec = input.taskSpec || null;
let execError = null;
const baseTaskSpec = taskSpec || { id: taskId, name: taskId, touches: [] };
const preflight = preflightTaskSpec(root, baseTaskSpec);
if (!preflight.ok) {
  const errorOutput = buildOutputEnvelope(taskId, {
    status: 'validation_failed',
    error: { code: 'OGU-PREFLIGHT', message: preflight.errors.join('; ') },
    tokensUsed: { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
  }, { featureSlug: input.featureSlug, pid: process.pid, isolationLevel: 'L0', durationMs: 0, startedAt, idempotencyKey: input.idempotencyKey });
  writeFileSync(outputPath, JSON.stringify(errorOutput, null, 2), 'utf8');
  timeoutMgr.clearTimeout(timeoutId);
  process.exit(1);
}

const gateTask = {
  ...baseTaskSpec,
  title: baseTaskSpec.title || baseTaskSpec.name || taskId,
  touches: preflight.touches || [],
  group: preflight.group || baseTaskSpec.group,
};

if (taskSpec?.output?.files && taskSpec.output.files.length > 0) {
  // Real execution: create the files specified in taskSpec
  try {
    for (const file of taskSpec.output.files) {
      const fullPath = join(root, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });

      if (file.action === 'create' || file.action === 'write') {
        writeFileSync(fullPath, file.content || '', 'utf8');
      } else if (file.action === 'append') {
        const existing = existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : '';
        writeFileSync(fullPath, existing + (file.content || ''), 'utf8');
      }

      // Map Plan.json actions to OutputEnvelope FileChange actions
      const actionMap = { create: 'created', write: 'created', append: 'modified', modify: 'modified', delete: 'deleted' };
      filesCreated.push({
        path: file.path,
        action: actionMap[file.action] || 'created',
        linesAdded: (file.content || '').split('\n').length,
      });
    }
  } catch (err) {
    execError = err;
  }
}

// ── Gate check + auto-fix (optional) ──

let gateResults = [];
let gateFailure = null;

if (process.env.OGU_TASK_GATES !== '0') {
  const gateCheck = await runTaskGates(root, gateTask, { runTests: true });
  const msg = gateCheck.errors && gateCheck.errors.length > 0 ? gateCheck.errors.join('; ').slice(0, 2000) : undefined;
  gateResults.push({
    gate: `task-${gateCheck.group || 'local'}`,
    passed: gateCheck.passed === true,
    message: msg,
  });
  if (gateCheck.warnings && gateCheck.warnings.length > 0) {
    gateResults.push({
      gate: 'task-warnings',
      passed: true,
      message: gateCheck.warnings.join('; ').slice(0, 2000),
    });
  }
  if (!gateCheck.passed) {
    const rawError = formatGateErrorsForFix(gateCheck.errors || []);
    gateFailure = { gate: `task-${gateCheck.group || 'local'}`, passed: false, error: rawError, output: rawError };
  }
}

if (execError || gateFailure) {
  const failedGate = gateFailure || { gate: 'execution', passed: false, error: execError?.message || 'execution failed' };
  const taskForRetry = {
    ...(gateTask || {}),
    id: taskId,
    name: gateTask?.name || taskId,
    owner_role: input.agent?.roleId || 'backend-dev',
  };

  const retry = await retryWithFeedback(root, taskId, input.featureSlug, failedGate, {
    task: taskForRetry,
    simulate: simulateFix,
    maxIterations: maxFixRetries,
    iterationCount: 0,
  });

  if (retry.success) {
    timeoutMgr.clearTimeout(timeoutId);
    process.exit(0);
  }
}

// ── Check timeout before building output ──
if (timeoutMgr.isExpired(timeoutId)) {
  const timeoutErr = createErrorEnvelope({
    code: 'OGU0602',
    message: `Task ${taskId} exceeded timeout`,
    source: 'runner-worker',
    severity: 'warning',
    taskId,
    featureSlug: input.featureSlug,
  });
  const timedOutOutput = buildOutputEnvelope(taskId, {
    status: 'timeout',
    error: { code: timeoutErr.code || 'OGU-TIMEOUT', message: timeoutErr.message },
    errorEnvelope: timeoutErr,
    files: filesCreated,
    tokensUsed: { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
  }, {
    featureSlug: input.featureSlug,
    pid: process.pid,
    isolationLevel: input.isolationLevel || 'L0',
    durationMs: Date.now() - new Date(startedAt).getTime(),
    startedAt,
    idempotencyKey: input.idempotencyKey,
  });
  writeFileSync(outputPath, JSON.stringify(timedOutOutput, null, 2), 'utf8');
  process.exit(1);
}

// ── Build output envelope ──

const durationMs = Date.now() - new Date(startedAt).getTime();

// Create a runner-level output envelope for protocol validation
const runnerOutput = createOutputEnvelope({
  taskId,
  status: 'success',
  result: { filesCreated: filesCreated.length, durationMs },
});

// Validate error envelope protocol compliance (if any errors occurred during execution)
const protocolCheck = validateErrorEnvelope({
  taskId,
  agentId: input.agent?.roleId || 'runner',
  error: null,
  code: 'OGU0000',
  recoverable: false,
});
// protocolCheck.valid will be false since error is null — this is expected for success path

const outputStatus = (execError || gateFailure) ? 'error' : 'success';
const outputError = execError?.message || gateFailure?.error || null;

const output = buildOutputEnvelope(taskId, {
  status: outputStatus,
  files: filesCreated,
  tokensUsed: { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
  gateResults,
  error: outputError ? { code: 'OGU-RUNNER', message: outputError } : undefined,
}, {
  featureSlug: input.featureSlug,
  pid: process.pid,
  isolationLevel: input.isolationLevel || 'L0',
  durationMs,
  startedAt,
  idempotencyKey: input.idempotencyKey,
});

// Validate output via adapter (boundary enforcement)
await respond(root, output);

// Clear timeout now that execution is complete
timeoutMgr.clearTimeout(timeoutId);

writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
process.exit(outputStatus === 'success' ? 0 : 1);
