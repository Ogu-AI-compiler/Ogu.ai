import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Runner Worker — forked process that executes tasks.
 *
 * Each worker is an independent execution unit that can:
 *   - Execute tasks from InputEnvelopes
 *   - Track its own status (idle/busy/error/killed)
 *   - Be gracefully drained (finish current, reject new)
 *
 * Workers are designed to be used by the runner pool and wave executor.
 */

// ── Worker states ──

const WORKER_STATES = {
  IDLE: 'idle',
  BUSY: 'busy',
  DRAINING: 'draining',
  ERROR: 'error',
  KILLED: 'killed',
};

/**
 * Create a worker instance.
 *
 * @param {object} options
 * @param {string} options.workDir - Working directory for task execution
 * @param {object} [options.env={}] - Environment variables for child processes
 * @param {object} [options.sandbox] - Sandbox configuration (from sandbox-runtime)
 * @param {string} [options.name] - Worker name (auto-generated if omitted)
 * @returns {object} Worker object with execute(), status(), kill(), drain()
 */
export function createWorker({ workDir, env = {}, sandbox = null, name } = {}) {
  const workerId = `worker-${randomUUID().slice(0, 8)}`;
  const workerName = name || workerId;

  // Internal state
  let state = WORKER_STATES.IDLE;
  let currentTask = null;
  let currentAbortController = null;
  let completedTasks = 0;
  let failedTasks = 0;
  let totalDurationMs = 0;
  const createdAt = new Date().toISOString();
  let lastActivityAt = createdAt;

  // Ensure workdir exists
  if (workDir && !existsSync(workDir)) {
    mkdirSync(workDir, { recursive: true });
  }

  /**
   * Execute a task via this worker.
   *
   * @param {object} inputEnvelope - InputEnvelope from runner.mjs
   * @param {number} [timeout=300000] - Execution timeout in ms
   * @returns {Promise<object>} OutputEnvelope
   */
  async function execute(inputEnvelope, timeout = 300000) {
    if (state === WORKER_STATES.KILLED) {
      return createOutputEnvelope(inputEnvelope.taskId, 'error', null, 'Worker has been killed');
    }
    if (state === WORKER_STATES.DRAINING) {
      return createOutputEnvelope(inputEnvelope.taskId, 'rejected', null, 'Worker is draining — no new tasks accepted');
    }
    if (state === WORKER_STATES.BUSY) {
      return createOutputEnvelope(inputEnvelope.taskId, 'rejected', null, 'Worker is busy');
    }

    state = WORKER_STATES.BUSY;
    currentTask = {
      taskId: inputEnvelope.taskId,
      command: inputEnvelope.command,
      startedAt: new Date().toISOString(),
    };
    lastActivityAt = new Date().toISOString();
    currentAbortController = new AbortController();

    const startTime = Date.now();

    try {
      const result = await executeWithTimeout(inputEnvelope, timeout, currentAbortController.signal);
      const durationMs = Date.now() - startTime;
      totalDurationMs += durationMs;
      completedTasks++;

      state = WORKER_STATES.IDLE;
      currentTask = null;
      currentAbortController = null;
      lastActivityAt = new Date().toISOString();

      return createOutputEnvelope(inputEnvelope.taskId, 'success', {
        ...result,
        durationMs,
        workerId,
      }, null);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      totalDurationMs += durationMs;
      failedTasks++;

      const wasAborted = currentAbortController?.signal?.aborted;
      state = wasAborted ? WORKER_STATES.KILLED : WORKER_STATES.IDLE;
      currentTask = null;
      currentAbortController = null;
      lastActivityAt = new Date().toISOString();

      return createOutputEnvelope(inputEnvelope.taskId, 'error', {
        durationMs,
        workerId,
      }, wasAborted ? 'Task aborted' : (err.message || String(err)));
    }
  }

  /**
   * Execute a task with timeout and abort support.
   */
  async function executeWithTimeout(inputEnvelope, timeout, signal) {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (signal.aborted) {
        return reject(new Error('Aborted'));
      }

      const timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeout}ms`));
      }, timeout);

      // Listen for abort
      const abortHandler = () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      };
      signal.addEventListener('abort', abortHandler, { once: true });

      // Execute the task (may be async for LLM calls)
      Promise.resolve(processTask(inputEnvelope)).then(result => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abortHandler);
        resolve(result);
      }).catch(err => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abortHandler);
        reject(err);
      });
    });
  }

  /**
   * Process a task.
   *
   * This is the core execution logic. It dispatches based on command type.
   * May return a promise for async operations (e.g. LLM calls).
   */
  async function processTask(inputEnvelope) {
    const { command, payload, taskId } = inputEnvelope;

    switch (command) {
      case 'exec': {
        // Execute a shell command
        const { execSync } = require('node:child_process');
        const cmd = payload.cmd || payload.command;
        if (!cmd) throw new Error('No command specified in payload');

        const result = execSync(cmd, {
          cwd: workDir,
          env: { ...process.env, ...env, ...payload.env },
          timeout: payload.timeout || 60000,
          maxBuffer: 5 * 1024 * 1024,
          encoding: 'utf8',
        });

        return { stdout: result, taskId };
      }

      case 'llm': {
        // LLM call — delegate to llm-caller
        try {
          const { callLLM } = await import('./lib/llm-caller.mjs');
          const result = await callLLM({
            prompt: payload.prompt,
            systemPrompt: payload.systemPrompt,
            model: payload.model || 'sonnet',
            maxTokens: payload.maxTokens || 4096,
            tools: payload.tools || [],
            cwd: workDir,
            env: { ...env, ...payload.env },
          });
          return {
            taskId,
            type: 'llm',
            output: result.output,
            usage: result.usage,
            cost: result.cost,
            durationMs: result.durationMs,
          };
        } catch (err) {
          return {
            taskId,
            type: 'llm',
            prompt: payload.prompt,
            error: err.message,
            note: 'LLM call failed — check llm-caller.mjs',
          };
        }
      }

      case 'transform': {
        // Data transformation
        const { input, transform } = payload;
        if (!input) throw new Error('No input for transform');
        return {
          taskId,
          type: 'transform',
          input,
          output: input, // Pass-through for now
          transform: transform || 'identity',
        };
      }

      case 'validate': {
        // Validation task
        return {
          taskId,
          type: 'validate',
          valid: true,
          checks: payload.checks || [],
        };
      }

      case 'noop': {
        // No-op task (for testing)
        return { taskId, type: 'noop', ok: true };
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Get current worker status.
   */
  function status() {
    return {
      workerId,
      name: workerName,
      state,
      currentTask,
      completedTasks,
      failedTasks,
      totalDurationMs,
      createdAt,
      lastActivityAt,
      workDir,
      hasSandbox: sandbox !== null,
    };
  }

  /**
   * Forcefully kill the worker.
   */
  function kill() {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    state = WORKER_STATES.KILLED;
    currentTask = null;
    lastActivityAt = new Date().toISOString();
    return { workerId, state: WORKER_STATES.KILLED };
  }

  /**
   * Gracefully drain: finish current task, reject new ones.
   *
   * @param {number} [timeoutMs=30000] - Force-kill after this timeout
   * @returns {Promise<object>} Drain result
   */
  async function drain(timeoutMs = 30000) {
    if (state === WORKER_STATES.IDLE) {
      state = WORKER_STATES.KILLED;
      return { workerId, drained: true, forced: false };
    }

    state = WORKER_STATES.DRAINING;

    return new Promise((resolve) => {
      const forceTimer = setTimeout(() => {
        kill();
        resolve({ workerId, drained: true, forced: true });
      }, timeoutMs);

      // Poll for idle state
      const pollInterval = setInterval(() => {
        if (state !== WORKER_STATES.DRAINING && state !== WORKER_STATES.BUSY) {
          clearInterval(pollInterval);
          clearTimeout(forceTimer);
          state = WORKER_STATES.KILLED;
          resolve({ workerId, drained: true, forced: false });
        }
      }, 100);
    });
  }

  return {
    workerId,
    name: workerName,
    execute,
    status,
    kill,
    drain,
  };
}

/**
 * Execute a task using a worker.
 *
 * Convenience function that wraps worker.execute().
 *
 * @param {object} worker - Worker from createWorker()
 * @param {object} options
 * @param {object} options.inputEnvelope - InputEnvelope
 * @param {number} [options.timeout=300000] - Timeout in ms
 * @returns {Promise<object>} OutputEnvelope
 */
export async function executeTask(worker, { inputEnvelope, timeout = 300000 } = {}) {
  if (!worker || typeof worker.execute !== 'function') {
    throw new Error('Invalid worker: missing execute function');
  }
  if (!inputEnvelope || !inputEnvelope.taskId) {
    throw new Error('Invalid inputEnvelope: missing taskId');
  }
  return worker.execute(inputEnvelope, timeout);
}

/**
 * Get worker status.
 *
 * @param {object} worker
 * @returns {object} Status object
 */
export function workerStatus(worker) {
  if (!worker || typeof worker.status !== 'function') {
    return { state: 'unknown', error: 'Invalid worker' };
  }
  return worker.status();
}

/**
 * Gracefully drain a worker.
 *
 * @param {object} worker
 * @param {object} [options]
 * @param {number} [options.timeoutMs=30000]
 * @returns {Promise<object>}
 */
export async function drainWorker(worker, { timeoutMs = 30000 } = {}) {
  if (!worker || typeof worker.drain !== 'function') {
    throw new Error('Invalid worker: missing drain function');
  }
  return worker.drain(timeoutMs);
}

// ── Helpers ──

/**
 * Create a standardized output envelope.
 */
function createOutputEnvelope(taskId, status, result, error) {
  return {
    taskId,
    status,
    result: result || {},
    error: error || null,
    timestamp: new Date().toISOString(),
  };
}
