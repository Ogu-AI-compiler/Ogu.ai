import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolveRuntimePath } from '../../ogu/commands/lib/runtime-paths.mjs';

// ── Phase 4C: Resource Governance ──
import { acquireResource, releaseResource, canStartWave, ensureConfig } from '../../ogu/commands/lib/resource-governor.mjs';

/**
 * Scheduler Loop — picks ready tasks via WFQ and dispatches to runners.
 *
 * Integrates with the formal scheduler (tools/ogu/commands/lib/scheduler.mjs)
 * for priority-based scheduling with fairness and starvation prevention.
 *
 * Reads: .ogu/state/scheduler-state.json
 * Writes: .ogu/runners/{taskId}.input.json (via runner pool)
 */

const SCHEDULER_STATE = (root) => resolveRuntimePath(root, 'state', 'scheduler-state.json');

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
  const dir = resolveRuntimePath(root, 'state');
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

  // Ensure resource governor config exists on first run
  try { ensureConfig(root); } catch { /* best-effort */ }

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    // Check system guards — skip scheduling if halted or frozen
    if (isSystemBlocked(root)) {
      return;
    }

    // ── Wave-based execution via kadima-engine allocations ──
    try {
      const { loadAllocations, saveAllocations } = await import('../../ogu/commands/lib/kadima-engine.mjs');
      const { buildDAG } = await import('../../ogu/commands/lib/dag-builder.mjs');
      const { executeWave } = await import('../../ogu/commands/lib/agent-runtime.mjs');

      const allAllocations = loadAllocations(root);
      const pendingAllocs = allAllocations.filter(a => a.status === 'active' || a.status === 'pending');

      if (pendingAllocs.length > 0) {
        // Build DAG from pending tasks to determine wave order
        const dagTasks = pendingAllocs.map(a => ({
          taskId: a.taskId,
          blockedBy: a.blockedBy || [],
        }));
        const dag = buildDAG(dagTasks);

        if (dag.valid && dag.waves.length > 0) {
          // Dispatch the first ready wave
          const waveTaskIds = dag.waves[0];

          // ── Resource Governor: check if wave can start ──
          try {
            const waveCheck = canStartWave(root, { taskIds: waveTaskIds });
            if (!waveCheck.canStart) {
              emitAudit('scheduler.wave_throttled', { reason: waveCheck.reason, waveTaskIds });
              return;
            }
          } catch { /* resource governor check best-effort */ }

          // Check runner capacity
          const capacity = runnerPool.availableSlots();
          if (capacity <= 0) return;

          // Limit wave size to available runner capacity
          const dispatchIds = waveTaskIds.slice(0, capacity);
          const featureSlug = pendingAllocs[0]?.featureSlug || 'unknown';

          const waveResult = await executeWave({
            waveIndex: tickCount,
            taskIds: dispatchIds,
            featureSlug,
            allocations: pendingAllocs,
            tasks: pendingAllocs.map(a => ({
              id: a.taskId,
              outputs: a.outputs || [],
              inputs: a.inputs || [],
              dependsOn: a.blockedBy || [],
              ...a,
            })),
            dryRun: false,
          });

          // Update allocation status based on wave results
          let modified = false;
          for (const completed of (waveResult.completed || [])) {
            const alloc = allAllocations.find(a => a.taskId === completed.taskId);
            if (alloc) {
              alloc.status = 'completed';
              alloc.completedAt = new Date().toISOString();
              modified = true;
            }
          }
          for (const failed of (waveResult.failed || [])) {
            const alloc = allAllocations.find(a => a.taskId === failed.taskId);
            if (alloc) {
              alloc.status = 'failed';
              alloc.error = failed.error;
              alloc.completedAt = new Date().toISOString();
              modified = true;
            }
          }

          if (modified) {
            saveAllocations(root, allAllocations, { featureSlug });
          }

          emitAudit('scheduler.wave_dispatched', {
            waveIndex: tickCount,
            featureSlug,
            dispatched: dispatchIds.length,
            completed: (waveResult.completed || []).length,
            failed: (waveResult.failed || []).length,
          });

          return; // Wave dispatch handled this tick
        }
      }
    } catch (waveErr) {
      // Wave-based dispatch failed — fall back to single-task dispatch below
      emitAudit('scheduler.wave_error', { error: waveErr.message });
    }

    // ── Enhanced scheduling via formal-scheduler + WFQ + policy router ──
    let nextTask = null;
    try {
      // Lazy-import enhanced scheduling modules to avoid circular deps
      const { createScheduler: createFormalScheduler, computeWFQWeights } = await import('../../ogu/commands/lib/formal-scheduler.mjs');
      const { createSchedulingRouter } = await import('../../ogu/commands/lib/scheduling-policy-router.mjs');
      const { createWFQIntegration } = await import('../../ogu/commands/lib/wfq-integration.mjs');
      const { createTaskPriorityQueue } = await import('../../ogu/commands/lib/task-priority-queue.mjs');
      const { createPersistentQueue } = await import('../../ogu/commands/lib/task-queue-persistent.mjs');
      const { createIdempotencyManager } = await import('../../ogu/commands/lib/idempotency-manager.mjs');
      const { createScheduler: createCronScheduler } = await import('../../ogu/commands/lib/cron-scheduler.mjs');
      const { createErrorRecoveryManager } = await import('../../ogu/commands/lib/error-recovery-manager.mjs');

      const state = loadSchedulerState(root);
      const pendingTasks = (state.queue || []).filter(t =>
        t.status === 'pending' && (!t.blockedBy || t.blockedBy.length === 0)
      );

      if (pendingTasks.length === 0) return;

      // Idempotency: skip tasks that were already dispatched in this tick cycle
      const idempotency = createIdempotencyManager();

      // Priority queue with deadline awareness
      const priorityQueue = createTaskPriorityQueue();
      for (const task of pendingTasks) {
        if (idempotency.check(task.taskId)) continue;
        priorityQueue.add({
          ...task,
          priority: task.priority === 'critical' ? 20 : task.priority === 'high' ? 10 : task.priority === 'low' ? -5 : 0,
          deadline: task.deadline ? new Date(task.deadline).getTime() : undefined,
        });
      }

      // Use formal scheduler for starvation prevention
      const formalSched = createFormalScheduler({ starvationThreshold: 10 });
      for (const task of pendingTasks) {
        formalSched.enqueue({ ...task, priority: task.priority || 'normal' });
      }
      formalSched.checkStarvation();

      // WFQ integration for fair class-based scheduling
      const wfq = createWFQIntegration();
      const classCounts = { critical: 0, high: 0, normal: 0, low: 0 };
      for (const task of pendingTasks) {
        const cls = task.priority || 'normal';
        if (!classCounts[cls]) classCounts[cls] = 0;
        classCounts[cls]++;
      }
      const wfqWeights = computeWFQWeights(classCounts);

      // Policy router: select scheduling algorithm based on queue state
      const router = createSchedulingRouter();
      router.addPolicy('deadline-heavy', {
        match: (ctx) => ctx.hasDeadlines,
        scheduler: () => 'priority-queue',
      });
      router.addPolicy('high-contention', {
        match: (ctx) => ctx.pending > 10,
        scheduler: () => 'wfq',
      });
      router.setDefault('fifo', () => 'fifo');

      const hasDeadlines = pendingTasks.some(t => t.deadline);
      const policy = router.selectPolicy({ pending: pendingTasks.length, hasDeadlines });

      // Select next task based on chosen policy
      if (policy.name === 'deadline-heavy') {
        nextTask = priorityQueue.next();
      } else if (policy.name === 'high-contention') {
        // Use formal scheduler with WFQ weights applied
        nextTask = formalSched.dequeue();
      } else {
        nextTask = pendingTasks[0]; // FIFO fallback
      }

      if (nextTask) {
        idempotency.record(nextTask.taskId, { dispatchedAt: new Date().toISOString() });
      }

      // Error recovery: configure recovery strategies for dispatch errors
      const errorRecovery = createErrorRecoveryManager();
      errorRecovery.addStrategy({ pattern: /timeout/i, action: 'retry', maxAttempts: 3 });
      errorRecovery.addStrategy({ pattern: /budget/i, action: 'defer', maxAttempts: 1 });
      errorRecovery.addStrategy({ pattern: /OGU5201/i, action: 'wait', maxAttempts: 5 });

      // Store error recovery on tick context for use in dispatch catch block
      if (!nextTask) return;

      // Persistent queue: flush pending state to disk for resume after restart
      const persistentQ = createPersistentQueue({ path: resolveRuntimePath(root, 'state', 'scheduler-persistent-queue.jsonl') });
      persistentQ.enqueue({ taskId: nextTask.taskId, scheduledAt: new Date().toISOString(), policy: policy.name });
      persistentQ.flush();

      emitAudit('scheduler.enhanced_select', {
        policy: policy.name,
        wfqWeights,
        pendingCount: pendingTasks.length,
        taskId: nextTask.taskId,
      });
    } catch {
      // Fallback to basic scheduling if enhanced modules unavailable
      try {
        const { scheduleNext } = await import('../../ogu/commands/lib/scheduler.mjs');
        nextTask = scheduleNext(root);
      } catch {
        nextTask = fallbackPickNext(root);
      }
    }

    if (!nextTask) return;

    // Check runner capacity
    const capacity = runnerPool.availableSlots();
    if (capacity <= 0) return;

    // Dispatch the scheduled task
    let governorSlotId = null;
    try {
      // ── Resource Governor: acquire slot before dispatch ──
      try {
        const govResult = acquireResource(root, {
          resourceType: 'model_call',
          agentId: nextTask.roleId || 'unknown',
          taskId: nextTask.taskId,
          priority: nextTask.priority === 'critical' ? 10 : nextTask.priority === 'high' ? 7 : 5,
        });
        if (!govResult.granted) {
          emitAudit('scheduler.resource_queued', {
            taskId: nextTask.taskId,
            position: govResult.position,
            reason: govResult.reason,
          });
          return; // Wait for slot to open
        }
        governorSlotId = govResult.slotId;
      } catch { /* governor not available — proceed */ }

      markTaskDispatched(root, nextTask.taskId);
      await runnerPool.dispatch(nextTask);

      emitAudit('scheduler.dispatch', {
        taskId: nextTask.taskId,
        featureSlug: nextTask.featureSlug,
        priority: nextTask.priority,
      });
    } catch (err) {
      // Attempt error recovery via error-recovery-manager
      let recovered = false;
      try {
        const { createErrorRecoveryManager } = await import('../../ogu/commands/lib/error-recovery-manager.mjs');
        const recovery = createErrorRecoveryManager();
        recovery.addStrategy({ pattern: /timeout/i, action: 'retry', maxAttempts: 3 });
        recovery.addStrategy({ pattern: /OGU5201/i, action: 'wait', maxAttempts: 5 });
        const result = recovery.recover(err);
        if (result.matched && result.action === 'retry') {
          emitAudit('scheduler.dispatch_retry', { taskId: nextTask.taskId, action: result.action });
          recovered = true;
        }
      } catch { /* recovery module unavailable */ }

      if (!recovered) {
        markTaskStatus(root, nextTask.taskId, 'dispatch_failed', err.message);
      }
      emitAudit('scheduler.dispatch_failed', {
        taskId: nextTask.taskId,
        error: err.message,
        recovered,
      });
    } finally {
      // ── Resource Governor: release slot after dispatch (success or failure) ──
      if (governorSlotId) {
        try { releaseResource(root, governorSlotId); } catch { /* best-effort */ }
      }
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
  const haltPath = resolveRuntimePath(root, 'state', 'system-halt.json');
  if (existsSync(haltPath)) {
    try {
      const halt = JSON.parse(readFileSync(haltPath, 'utf8'));
      if (halt.halted) return true;
    } catch { /* ignore corrupt */ }
  }

  const freezePath = resolveRuntimePath(root, 'state', 'company-freeze.json');
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
