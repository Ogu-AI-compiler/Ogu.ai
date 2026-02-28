import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Scheduler Loop — picks ready tasks via WFQ and dispatches to runners.
 *
 * Integrates with the formal scheduler (tools/ogu/commands/lib/scheduler.mjs)
 * for priority-based scheduling with fairness and starvation prevention.
 *
 * Reads: .ogu/state/scheduler-state.json
 * Writes: .ogu/runners/{taskId}.input.json (via runner pool)
 */

const SCHEDULER_STATE = (root) => join(root, '.ogu/state/scheduler-state.json');

function loadSchedulerState(root) {
  const path = SCHEDULER_STATE(root);
  if (!existsSync(path)) {
    return { version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString() };
  }
}

function saveSchedulerState(root, state) {
  state.updatedAt = new Date().toISOString();
  const dir = join(root, '.ogu/state');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SCHEDULER_STATE(root), JSON.stringify(state, null, 2), 'utf8');
}

function markTaskDispatched(root, taskId) {
  const state = loadSchedulerState(root);
  const task = state.queue.find(t => t.taskId === taskId);
  if (task) {
    task.status = 'dispatched';
    task.dispatchedAt = new Date().toISOString();
  }
  saveSchedulerState(root, state);
}

function markTaskStatus(root, taskId, status, error) {
  const state = loadSchedulerState(root);
  const task = state.queue.find(t => t.taskId === taskId);
  if (task) {
    task.status = status;
    if (error) task.error = error;
  }
  saveSchedulerState(root, state);
}

export function createSchedulerLoop({ root, intervalMs, runnerPool, emitAudit }) {
  let timer = null;
  let running = true;
  let lastTick = null;
  let tickCount = 0;

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    // Check system guards — skip scheduling if halted or frozen
    if (isSystemBlocked(root)) {
      return;
    }

    // Try to use the formal WFQ scheduler
    let nextTask = null;
    try {
      const { scheduleNext } = await import('../../ogu/commands/lib/scheduler.mjs');
      nextTask = scheduleNext(root);
    } catch {
      // Fallback to basic FIFO if formal scheduler unavailable
      nextTask = fallbackPickNext(root);
    }

    if (!nextTask) return;

    // Check runner capacity
    const capacity = runnerPool.availableSlots();
    if (capacity <= 0) return;

    // Dispatch the scheduled task
    try {
      markTaskDispatched(root, nextTask.taskId);
      await runnerPool.dispatch(nextTask);

      emitAudit('scheduler.dispatch', {
        taskId: nextTask.taskId,
        featureSlug: nextTask.featureSlug,
        priority: nextTask.priority,
      });
    } catch (err) {
      markTaskStatus(root, nextTask.taskId, 'dispatch_failed', err.message);
      emitAudit('scheduler.dispatch_failed', {
        taskId: nextTask.taskId,
        error: err.message,
      });
    }
  };

  // Start the loop
  timer = setInterval(async () => {
    if (!running) return;
    try {
      await tick();
    } catch (err) {
      emitAudit('scheduler.loop_error', { error: err.message });
    }
  }, intervalMs);

  return {
    name: 'scheduler',
    get isRunning() { return running; },
    get lastTick() { return lastTick; },
    get tickCount() { return tickCount; },
    stop() { running = false; clearInterval(timer); },
    forceTick: tick,
  };
}

/**
 * Check if system is halted or frozen — if so, no new dispatches allowed.
 */
function isSystemBlocked(root) {
  const haltPath = join(root, '.ogu/state/system-halt.json');
  if (existsSync(haltPath)) {
    try {
      const halt = JSON.parse(readFileSync(haltPath, 'utf8'));
      if (halt.halted) return true;
    } catch { /* ignore corrupt */ }
  }

  const freezePath = join(root, '.ogu/state/company-freeze.json');
  if (existsSync(freezePath)) {
    try {
      const freeze = JSON.parse(readFileSync(freezePath, 'utf8'));
      if (freeze.frozen) return true;
    } catch { /* ignore corrupt */ }
  }

  return false;
}

/**
 * Fallback: basic FIFO scheduling when formal scheduler is unavailable.
 */
function fallbackPickNext(root) {
  const state = loadSchedulerState(root);
  if (!state.queue || state.queue.length === 0) return null;

  return state.queue.find(t =>
    t.status === 'pending' &&
    (!t.blockedBy || t.blockedBy.length === 0)
  ) || null;
}
