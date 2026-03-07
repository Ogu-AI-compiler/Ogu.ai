import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { buildInputEnvelope } from '../../contracts/envelopes/input.mjs';
import { buildOutputEnvelope } from '../../contracts/envelopes/output.mjs';
import { getRunnersDir, getStateDir, resolveOguPath } from '../../ogu/commands/lib/runtime-paths.mjs';

/**
 * Runner Pool — manages worker processes.
 *
 * Milestone 2: Uses child_process.fork() for local execution.
 * Milestone 3: Will switch to HTTP dispatch to remote runners.
 */

const WORKER_PATH = join(import.meta.dirname, '../runner-worker.mjs');

export class RunnerPool {
  constructor({ root, maxConcurrent, timeoutMs, emitAudit }) {
    this.root = root;
    this.maxConcurrent = maxConcurrent;
    this.timeoutMs = timeoutMs;
    this.emitAudit = emitAudit;
    this.active = new Map(); // taskId → { process, startedAt, timeout }
  }

  availableSlots() {
    return this.maxConcurrent - this.active.size;
  }

  status() {
    return {
      maxConcurrent: this.maxConcurrent,
      active: this.active.size,
      available: this.availableSlots(),
      tasks: Array.from(this.active.entries()).map(([id, info]) => ({
        taskId: id,
        pid: info.pid,
        startedAt: info.startedAt,
      })),
    };
  }

  async dispatch(task) {
    if (this.availableSlots() <= 0) {
      // Build an error envelope for capacity errors so callers get structured OGU errors
      try {
        const { createErrorEnvelope: makeEnvelope } = await import('../../ogu/commands/lib/error-envelope.mjs');
        const envelope = makeEnvelope({
          code: 'OGU5201',
          message: 'No available runner slots',
          source: 'RunnerPool',
          severity: 'error',
          taskId: task.taskId,
          featureSlug: task.featureSlug,
        });
        const { createErrorEnvelope: makeProtoEnvelope, validateErrorEnvelope } = await import('../../ogu/commands/lib/error-envelope-protocol.mjs');
        const protoEnvelope = makeProtoEnvelope({
          taskId: task.taskId,
          agentId: 'runner-pool',
          error: envelope.message,
          code: envelope.code,
          recoverable: envelope.recoverable,
          suggestedAction: 'retry',
        });
        validateErrorEnvelope(protoEnvelope);
        this.emitAudit('runner.capacity_error', { envelope: protoEnvelope });
      } catch { /* envelope modules unavailable — fall through */ }
      throw new Error('OGU5201: No available runner slots');
    }

    const { taskId, featureSlug, dryRun, taskSpec } = task;
    const runnersDir = getRunnersDir(this.root);
    mkdirSync(runnersDir, { recursive: true });

    // Validate runner contract for this task using the abstract runner interface
    try {
      const { validateRunner, createInputEnvelope: makeRunnerInput, RUNNER_TYPES } = await import('../../ogu/commands/lib/runner.mjs');
      const runnerHandle = { name: 'kadima-pool', type: 'local', execute: async () => {} };
      const validation = validateRunner(runnerHandle);
      if (!validation.valid) {
        this.emitAudit('runner.invalid_contract', { errors: validation.errors, taskId });
      }
      // Build a runner-level input envelope for traceability
      const runnerInput = makeRunnerInput({ taskId, command: 'execute', payload: { featureSlug } });
      this.emitAudit('runner.input_envelope', { envelopeTimestamp: runnerInput.timestamp, taskId });
    } catch { /* runner module unavailable */ }

    // Register local runner in the abstract runner pool for capacity tracking
    try {
      const { createRunnerPool: makeAbstractPool } = await import('../../ogu/commands/lib/runner-pool.mjs');
      const abstractPool = makeAbstractPool();
      abstractPool.addRunner('kadima-local', { type: 'local', maxConcurrent: this.maxConcurrent });
      abstractPool.acquire(taskId);
      this.emitAudit('runner.pool_acquired', { taskId, poolStatus: abstractPool.getPoolStatus() });
    } catch { /* runner-pool module unavailable */ }

    // Load OrgSpec for routing
    const orgSpecPath = resolveOguPath(this.root, 'OrgSpec.json');
    const orgSpec = existsSync(orgSpecPath)
      ? JSON.parse(readFileSync(orgSpecPath, 'utf8'))
      : null;

    // Resolve role: use task.roleId → match from OrgSpec → fallback to first role
    const roles = orgSpec?.roles || [];
    const role = (task.roleId && roles.find(r => r.roleId === task.roleId))
      || roles.find(r => r.phases?.includes('build'))
      || roles[0];
    const provider = orgSpec?.providers?.[0];
    const model = provider?.models?.[0];

    // Build InputEnvelope
    const inputEnvelope = buildInputEnvelope({
      taskId,
      featureSlug,
      taskName: taskId,
      agent: {
        roleId: role?.roleId || 'developer',
        sessionId: randomUUID(),
        capabilities: role?.capabilities || ['code_generation'],
      },
      prompt: `Execute task "${taskId}" for feature "${featureSlug}".`,
      routingDecision: {
        provider: provider?.id || 'anthropic',
        model: model?.id || 'claude-sonnet-4-20250514',
        tier: model?.tier || 'standard',
        reason: 'Default routing from Kadima scheduler',
      },
      budget: {
        maxTokens: role?.maxTokensPerTask || 100000,
        maxCost: 10,
        remainingDaily: 50,
        currency: 'USD',
      },
      sandboxPolicy: {
        allowedPaths: role?.sandbox?.allowedPaths || ['src/**'],
        blockedPaths: [],
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
        blockedTools: [],
        envFilter: [],
        networkAccess: 'none',
        networkAllowlist: [],
      },
      blastRadius: {
        allowed_write: role?.sandbox?.allowedPaths || ['src/**'],
      },
    });

    // Attach taskSpec if provided (for file-producing runners)
    if (taskSpec) {
      inputEnvelope.taskSpec = taskSpec;
    }

    // Write InputEnvelope
    writeFileSync(
      join(runnersDir, `${taskId}.input.json`),
      JSON.stringify(inputEnvelope, null, 2),
      'utf8'
    );

    // For dry-run tasks, execute inline (no fork needed)
    if (dryRun) {
      return this._executeDryRun(taskId, featureSlug, inputEnvelope, runnersDir);
    }

    // Fork runner worker
    return this._forkWorker(taskId, featureSlug, runnersDir);
  }

  async _executeDryRun(taskId, featureSlug, inputEnvelope, runnersDir) {
    const startedAt = new Date().toISOString();

    const output = buildOutputEnvelope(taskId, {
      status: 'success',
      files: [],
      tokensUsed: { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
    }, {
      featureSlug,
      pid: process.pid,
      isolationLevel: 'L0',
      durationMs: 0,
      startedAt,
      idempotencyKey: inputEnvelope.idempotencyKey,
    });

    writeFileSync(
      join(runnersDir, `${taskId}.output.json`),
      JSON.stringify(output, null, 2),
      'utf8'
    );

    // Update scheduler state: mark task as completed
    this._markTaskCompleted(taskId);

    this.emitAudit('runner.completed', {
      taskId,
      featureSlug,
      status: 'success',
      dryRun: true,
      durationMs: 0,
    });

    return { taskId, pid: process.pid };
  }

  _forkWorker(taskId, featureSlug, runnersDir) {
    const child = fork(WORKER_PATH, [taskId], {
      cwd: this.root,
      env: {
        ...process.env,
        OGU_ROOT: this.root,
        OGU_TASK_ID: taskId,
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    const startedAt = new Date().toISOString();

    this.active.set(taskId, {
      pid: child.pid,
      startedAt,
      process: child,
    });

    // Wire timeout manager for structured timeout tracking
    let timeoutId = null;
    let mgr = null;
    Promise.resolve().then(async () => {
      try {
        const { createTimeoutManager } = await import('../../ogu/commands/lib/timeout-manager.mjs');
        mgr = createTimeoutManager();
        timeoutId = mgr.setTimeout(`task-${taskId}`, this.timeoutMs);
      } catch { /* timeout-manager unavailable */ }
    });

    const timeout = setTimeout(() => {
      if (mgr && timeoutId && mgr.isExpired(timeoutId)) {
        this.emitAudit('runner.timeout', { taskId, timeoutMs: this.timeoutMs, managed: true });
      } else {
        this.emitAudit('runner.timeout', { taskId, timeoutMs: this.timeoutMs });
      }
      child.kill('SIGTERM');
    }, this.timeoutMs);

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (mgr && timeoutId) {
        try { mgr.clearTimeout(timeoutId); } catch { /* ignore */ }
      }
      this.active.delete(taskId);

      if (code === 0) {
        this._markTaskCompleted(taskId);

        // Read output envelope for audit info
        const outputPath = join(runnersDir, `${taskId}.output.json`);
        let filesCount = 0;
        if (existsSync(outputPath)) {
          const output = JSON.parse(readFileSync(outputPath, 'utf8'));
          filesCount = (output.files || []).length;
        }

        this.emitAudit('runner.completed', {
          taskId,
          featureSlug,
          status: 'success',
          dryRun: false,
          filesCreated: filesCount,
          durationMs: Date.now() - new Date(startedAt).getTime(),
        });
      } else if (code !== 0 && code !== null) {
        // Non-zero exit: apply retry policy + emit structured error envelope
        Promise.resolve().then(async () => {
          try {
            const { createRetryPolicy } = await import('../../ogu/commands/lib/retry-policy.mjs');
            const retryPolicy = createRetryPolicy({ strategy: 'exponential', delay: 500, maxRetries: 2 });
            const attempt = 1; // First failure
            if (retryPolicy.shouldRetry(attempt)) {
              this.emitAudit('runner.retry_eligible', {
                taskId,
                code,
                attempt,
                nextDelayMs: retryPolicy.getDelay(attempt),
                strategy: retryPolicy.strategy,
              });
            }

            const { createErrorEnvelope: makeEnvelope } = await import('../../ogu/commands/lib/error-envelope.mjs');
            const errEnvelope = makeEnvelope({
              code: 'OGU0602',
              message: `Runner exited with code ${code}`,
              source: 'RunnerPool._forkWorker',
              severity: 'error',
              taskId,
              featureSlug,
            });
            this.emitAudit('runner.error_envelope', { envelopeId: errEnvelope.id, taskId, code });

            const { createRunnerProtocol } = await import('../../ogu/commands/lib/distributed-runner-protocol.mjs');
            const protocol = createRunnerProtocol();
            const errResponse = protocol.encodeResponse({
              requestId: null,
              status: 'error',
              result: null,
              metrics: { durationMs: Date.now() - new Date(startedAt).getTime() },
              error: `Exit code: ${code}`,
            });
            this.emitAudit('runner.protocol_error_response', { responseId: errResponse.id, taskId });
          } catch { /* error envelope modules unavailable */ }
        });
      }

      this.emitAudit('runner.exit', { taskId, code });
    });

    // Wire distributed runner protocol for request encoding (traceability)
    Promise.resolve().then(async () => {
      try {
        const { registerRunner, updateRunnerStatus } = await import('../../ogu/commands/lib/distributed-runner.mjs');
        const { createRunnerProtocol } = await import('../../ogu/commands/lib/distributed-runner-protocol.mjs');
        const { createLocalRunner } = await import('../../ogu/commands/lib/runner-local.mjs');

        // Register the local worker as a distributed runner entry
        registerRunner({
          root: this.root,
          id: `local-${taskId}`,
          host: 'localhost',
          port: 0,
          capabilities: ['code_generation', 'build'],
          maxConcurrency: 1,
        });
        updateRunnerStatus({ root: this.root, id: `local-${taskId}`, status: 'running', activeTasks: 1 });

        // Build protocol request for this dispatch (for audit trail)
        const protocol = createRunnerProtocol();
        const request = protocol.encodeRequest({
          taskId,
          agentId: `worker-${child.pid}`,
          command: 'execute',
          args: { featureSlug, pid: child.pid },
        });
        this.emitAudit('runner.protocol_request', { requestId: request.id, taskId, pid: child.pid });

        // Validate local runner interface
        const localRunner = createLocalRunner({ workDir: this.root, name: `kadima-worker-${taskId}` });
        this.emitAudit('runner.local_registered', { name: localRunner.name, type: localRunner.type, taskId });
      } catch { /* distributed runner modules unavailable */ }
    });

    return { taskId, pid: child.pid };
  }

  _markTaskCompleted(taskId) {
    const statePath = join(getStateDir(this.root), 'scheduler-state.json');
    if (!existsSync(statePath)) return;

    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    const task = state.queue.find(t => t.taskId === taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
    }

    // Resolve dependencies: remove this taskId from all blockedBy arrays
    for (const t of state.queue) {
      if (t.blockedBy && t.blockedBy.includes(taskId)) {
        t.blockedBy = t.blockedBy.filter(id => id !== taskId);
      }
    }

    state.updatedAt = new Date().toISOString();
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

    // Also update feature state task list
    if (task?.featureSlug) {
      this._updateFeatureTask(task.featureSlug, taskId, 'completed');
    }
  }

  _updateFeatureTask(featureSlug, taskId, status) {
    const featurePath = join(getStateDir(this.root), 'features', `${featureSlug}.state.json`);
    if (!existsSync(featurePath)) return;

    const featureState = JSON.parse(readFileSync(featurePath, 'utf8'));
    if (!featureState.tasks) return;

    const task = featureState.tasks.find(t => t.taskId === taskId);
    if (task) {
      task.status = status;
      task.completedAt = new Date().toISOString();
    }
    featureState.updatedAt = new Date().toISOString();
    writeFileSync(featurePath, JSON.stringify(featureState, null, 2), 'utf8');
  }

  async drainWithTimeout(timeoutMs) {
    if (this.active.size === 0) return;

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.active.size === 0) {
          clearInterval(check);
          resolve();
        }
      }, 200);

      setTimeout(() => {
        clearInterval(check);
        for (const [taskId, info] of this.active) {
          info.process?.kill('SIGKILL');
          this.emitAudit('runner.force_killed', { taskId });
        }
        resolve();
      }, timeoutMs);
    });
  }
}
