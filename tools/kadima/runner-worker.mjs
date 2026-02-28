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

const taskId = process.argv[2];
const root = process.env.OGU_ROOT || process.cwd();

if (!taskId) {
  console.error('Usage: runner-worker.mjs <taskId>');
  process.exit(1);
}

const inputPath = join(root, `.ogu/runners/${taskId}.input.json`);
const outputPath = join(root, `.ogu/runners/${taskId}.output.json`);

if (!existsSync(inputPath)) {
  console.error(`InputEnvelope not found: ${inputPath}`);
  process.exit(1);
}

const input = JSON.parse(readFileSync(inputPath, 'utf8'));
const startedAt = new Date().toISOString();

// ── Validate via Kadima adapter (boundary enforcement) ──
const dispatchResult = await dispatch(root, input);
if (!dispatchResult.accepted) {
  const errorOutput = buildOutputEnvelope(taskId, {
    status: 'error',
    error: dispatchResult.error,
    tokensUsed: { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
  }, { featureSlug: input.featureSlug, pid: process.pid, isolationLevel: 'L0', durationMs: 0, startedAt, idempotencyKey: input.idempotencyKey });
  writeFileSync(outputPath, JSON.stringify(errorOutput, null, 2), 'utf8');
  process.exit(1);
}

// ── Execute task ──

const filesCreated = [];
const taskSpec = input.taskSpec || null;

if (taskSpec?.output?.files && taskSpec.output.files.length > 0) {
  // Real execution: create the files specified in taskSpec
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
}

// ── Build output envelope ──

const output = buildOutputEnvelope(taskId, {
  status: 'success',
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

// Validate output via adapter (boundary enforcement)
await respond(root, output);

writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
process.exit(0);
