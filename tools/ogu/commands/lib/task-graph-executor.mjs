/**
 * task-graph-executor.mjs — Slice 428
 * Execution loop with real-time dependency checking, gate runner, and retry.
 *
 * Replaces the sequential for-loop in project-executor.mjs with a proper
 * scheduler-driven loop that:
 *   1. Uses getReadyAssignments() to find tasks whose deps are completed
 *   2. Respects capacity (via checkCapacityForTask)
 *   3. Runs tasks via executeAgentTaskCore
 *   4. After execution, runs each gate in task.gates via runGate()
 *   5. On gate failure, calls retryWithFeedback() (up to MAX_GATE_RETRIES)
 *   6. Skips tasks whose dependencies have failed
 *   7. Saves execution state after every task
 *   8. Emits lifecycle events (task.started, task.completed, task.failed, etc.)
 *
 * Exports:
 *   executeTaskGraph(root, projectId, tasks, opts) → ExecutionResult
 *   runGate(gate, task, result, opts) → GateResult
 *   getReadyTaskIds(tasks, completedIds, failedIds, skippedIds) → string[]
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { executeAgentTaskCore } from './agent-executor.mjs';
import { injectPatternsForTask, recordTaskOutcome, updatePatternOutcomes } from './execution-memory.mjs';
import { checkCapacityForTask } from './capacity-scheduler.mjs';
import { recordTaskMetric } from './execution-metrics.mjs';
import { buildGateFeedback, retryWithFeedback, detectLearningOpportunity } from './gate-feedback.mjs';
import { getProjectsDir } from './runtime-paths.mjs';

const MAX_GATE_RETRIES = 3;
const MAX_ITERATIONS = 50; // safety valve for infinite loops

// ── State helpers ─────────────────────────────────────────────────────────────

function statePath(root, projectId) {
  return join(getProjectsDir(root), projectId, 'execution-state.json');
}

function saveState(root, projectId, state) {
  const dir = join(getProjectsDir(root), projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(statePath(root, projectId), JSON.stringify(state, null, 2), 'utf-8');
}

// ── Ready-task detection ──────────────────────────────────────────────────────

/**
 * getReadyTaskIds(tasks, completedIds, failedIds, skippedIds) → string[]
 *
 * A task is "ready" when:
 *   - Status is pending (not completed, failed, skipped, running)
 *   - ALL dependsOn entries are in completedIds (not just "not failed")
 *
 * If a dependency is in failedIds/skippedIds, the task is permanently blocked.
 */
export function getReadyTaskIds(tasks, completedIds = new Set(), failedIds = new Set(), skippedIds = new Set()) {
  const ready = [];

  for (const task of tasks) {
    const taskId = task.id || task.task_id;
    if (!taskId) continue;

    // Skip if already settled
    if (completedIds.has(taskId) || failedIds.has(taskId) || skippedIds.has(taskId)) continue;

    const deps = task.dependsOn || task.depends_on || [];

    // Check if any dependency failed or was skipped → block this task
    const hasBlockedDep = deps.some(d => failedIds.has(d) || skippedIds.has(d));
    if (hasBlockedDep) continue;

    // Check if all deps are complete
    const allDepsComplete = deps.every(d => completedIds.has(d));
    if (!allDepsComplete) continue;

    ready.push(taskId);
  }

  return ready;
}

// ── Gate runner ───────────────────────────────────────────────────────────────

/**
 * runGate(gate, task, taskResult, opts) → GateResult
 *
 * In simulate mode: always passes.
 * In real mode: stub — passes for now; extend with actual command runners.
 *
 * GateResult: { gate, passed, error?, output?, simulated? }
 */
export function runGate(gate, task, taskResult, opts = {}) {
  if (opts.simulate) {
    return { gate, passed: true, simulated: true };
  }

  // If the task itself failed (no output), fail output-exists gate
  if (gate === 'output-exists' && !taskResult.success) {
    return {
      gate,
      passed: false,
      error: `Task failed to produce output: ${taskResult.error || 'unknown error'}`,
    };
  }

  // If the task returned a gate_passed map, use it
  if (taskResult.gates && typeof taskResult.gates === 'object') {
    const result = taskResult.gates[gate];
    if (result !== undefined) {
      return { gate, passed: Boolean(result), output: taskResult.gateOutput?.[gate] };
    }
  }

  // Default: pass if task succeeded, fail otherwise
  return {
    gate,
    passed: taskResult.success === true,
    error: taskResult.success ? null : (taskResult.error || `task failed`),
  };
}

/**
 * runTaskGates(task, taskResult, opts) → { allPassed, gateResults }
 */
async function runTaskGates(task, taskResult, opts) {
  const gates = task.gates || [];
  const gateResults = [];

  for (const gate of gates) {
    const result = runGate(gate, task, taskResult, opts);
    gateResults.push(result);
    if (!result.passed) break; // stop at first failure
  }

  const allPassed = gateResults.every(r => r.passed);
  return { allPassed, gateResults };
}

// ── Main executor ─────────────────────────────────────────────────────────────

/**
 * executeTaskGraph(root, projectId, tasks, opts) → ExecutionResult
 *
 * opts:
 *   simulate    — skip real LLM calls, gates always pass
 *   onEvent     — callback(event) for lifecycle events
 *   maxConcurrent — max parallel tasks per wave (default: 1, sequential)
 *   existingState — resume from this state instead of starting fresh
 */
export async function executeTaskGraph(root, projectId, tasks, opts = {}) {
  const {
    simulate = false,
    onEvent = null,
    maxConcurrent = 1,
    existingState = null,
  } = opts;

  const runId = existingState?.runId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const emit = (type, data = {}) => {
    if (typeof onEvent === 'function') onEvent({ type, projectId, ...data });
  };

  // Initialise or resume execution state
  const completedIds = new Set();
  const failedIds = new Set();
  const skippedIds = new Set();
  const results = [];

  let execState;

  if (existingState) {
    // Resume: pre-populate sets from previous state
    execState = { ...existingState, status: 'running', resumedAt: new Date().toISOString(), runId };
    for (const [tid, ts] of Object.entries(execState.tasks || {})) {
      if (ts.status === 'completed') completedIds.add(tid);
      else if (ts.status === 'failed') failedIds.add(tid);
      else if (ts.status === 'skipped') skippedIds.add(tid);
    }
    emit('project.resumed', { totalTasks: tasks.length, alreadyCompleted: completedIds.size });
  } else {
    execState = {
      projectId,
      runId,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      tasks: Object.fromEntries(tasks.map(t => [t.id || t.task_id, { status: 'pending' }])),
      summary: null,
    };
    emit('project.started', { totalTasks: tasks.length });
  }

  saveState(root, projectId, execState);

  const taskById = new Map(tasks.map(t => [t.id || t.task_id, t]));
  let iteration = 0;

  // Main scheduling loop
  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const readyIds = getReadyTaskIds(tasks, completedIds, failedIds, skippedIds);

    if (readyIds.length === 0) {
      // Check if there are still pending tasks
      const pendingCount = tasks.filter(t => {
        const tid = t.id || t.task_id;
        return !completedIds.has(tid) && !failedIds.has(tid) && !skippedIds.has(tid);
      }).length;

      if (pendingCount === 0) break; // all done

      // Remaining tasks are permanently blocked by failed deps
      for (const task of tasks) {
        const tid = task.id || task.task_id;
        if (!completedIds.has(tid) && !failedIds.has(tid) && !skippedIds.has(tid)) {
          skippedIds.add(tid);
          execState.tasks[tid] = {
            status: 'skipped',
            skippedAt: new Date().toISOString(),
            reason: 'dependency_failed',
          };
          emit('task.skipped', { taskId: tid, reason: 'dependency_failed' });
        }
      }
      saveState(root, projectId, execState);
      break;
    }

    // Slice to maxConcurrent
    const wave = readyIds.slice(0, maxConcurrent);

    // Run wave (sequential for now; extend to Promise.all for maxConcurrent > 1)
    for (const taskId of wave) {
      const task = taskById.get(taskId);
      if (!task) { skippedIds.add(taskId); continue; }

      // Capacity check
      const capacityCheck = checkCapacityForTask(root, task);
      if (!capacityCheck.canRun) {
        skippedIds.add(taskId);
        execState.tasks[taskId] = {
          status: 'skipped',
          skippedAt: new Date().toISOString(),
          reason: capacityCheck.reason,
        };
        saveState(root, projectId, execState);
        emit('task.skipped', { taskId, reason: capacityCheck.reason });
        continue;
      }

      // Pattern injection
      const enrichedTask = injectPatternsForTask(root, task);

      execState.tasks[taskId] = { status: 'running', startedAt: new Date().toISOString() };
      saveState(root, projectId, execState);
      emit('task.started', { taskId, taskName: task.title || task.name || taskId });

      const taskStartMs = Date.now();
      let taskResult;

      try {
        taskResult = await executeAgentTaskCore(root, {
          featureSlug: projectId,
          taskId,
          roleId: task.owner_role || null,
          simulate,
          taskSpec: enrichedTask,
        });
      } catch (err) {
        taskResult = { success: false, status: 'executor_error', error: err.message, durationMs: Date.now() - taskStartMs };
      }

      // In simulate mode, any failure from the executor is treated as simulated success
      // (simulate is for testing workflow mechanics, not actual task execution)
      if (simulate && taskResult.success === false) {
        taskResult = { success: true, status: 'simulated', simulated: true, durationMs: taskResult.durationMs || (Date.now() - taskStartMs), cost: 0 };
      }

      taskResult.durationMs = taskResult.durationMs || (Date.now() - taskStartMs);

      // ── Gate checks ────────────────────────────────────────────────────────
      let finalResult = taskResult;
      let gateIterations = 0;

      if (taskResult.success !== false) {
        const { allPassed, gateResults } = await runTaskGates(task, taskResult, { simulate });

        if (!allPassed) {
          const failedGate = gateResults.find(g => !g.passed);

          // Retry with feedback up to MAX_GATE_RETRIES
          while (gateIterations < MAX_GATE_RETRIES) {
            gateIterations++;
            emit('task.gate_failed', {
              taskId,
              gate: failedGate.gate,
              iteration: gateIterations,
            });

            try {
              const retryResult = await retryWithFeedback(root, taskId, projectId, failedGate, {
                task,
                simulate,
                iterationCount: gateIterations,
                maxIterations: MAX_GATE_RETRIES,
              });

              if (retryResult.stopped) break;

              finalResult = retryResult.result || finalResult;

              // Re-run gates
              const recheck = await runTaskGates(task, finalResult, { simulate });
              if (recheck.allPassed) break;
            } catch {
              break;
            }
          }
        }
      }

      // Record metrics
      recordTaskMetric(root, projectId, {
        taskId,
        runId,
        runStartedAt: execState.startedAt,
        ownerRole: task.owner_role || null,
        ownerAgentId: task.owner_agent_id || null,
        success: finalResult.success,
        status: finalResult.status,
        durationMs: finalResult.durationMs || 0,
        cost: finalResult.cost || 0,
        gateResult: finalResult.success || null,
      });

      // Learning
      try {
        recordTaskOutcome(root, task, finalResult, gateIterations);
        updatePatternOutcomes(root, enrichedTask._injectedPatterns || [], finalResult.success);
      } catch { /* non-fatal */ }

      const taskRecord = {
        taskId,
        success: finalResult.success,
        status: finalResult.status || (finalResult.success ? 'completed' : 'failed'),
        durationMs: finalResult.durationMs || 0,
        cost: finalResult.cost || 0,
        error: finalResult.error || null,
        gateIterations,
      };
      results.push(taskRecord);

      if (finalResult.success !== false) {
        completedIds.add(taskId);
        execState.tasks[taskId] = {
          ...taskRecord,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };
        emit('task.completed', { taskId, result: taskRecord });
      } else {
        failedIds.add(taskId);
        execState.tasks[taskId] = {
          ...taskRecord,
          status: 'failed',
          completedAt: new Date().toISOString(),
        };
        emit('task.failed', { taskId, error: finalResult.error });
      }

      saveState(root, projectId, execState);
    }
  }

  // Final state
  const totalFailed = failedIds.size;
  const totalCompleted = completedIds.size;
  const totalSkipped = skippedIds.size;
  const total = tasks.length;

  execState.status =
    totalFailed === 0 && totalSkipped === 0 ? 'completed' :
    totalCompleted === 0 ? 'failed' :
    'partial';

  execState.completedAt = new Date().toISOString();
  execState.summary = {
    total,
    completed: totalCompleted,
    failed: totalFailed,
    skipped: totalSkipped,
    success: totalFailed === 0,
  };

  saveState(root, projectId, execState);
  emit('project.completed', execState.summary);

  return {
    success: totalFailed === 0 && totalSkipped === 0,
    projectId,
    tasks: results,
    summary: execState.summary,
  };
}
