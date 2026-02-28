import { buildDAG } from './dag-builder.mjs';
import { allocatePlan } from './task-allocator.mjs';
import { storeArtifact, loadArtifacts } from './artifact-store.mjs';
import { emitAudit } from './audit-emitter.mjs';
import { loadOrgSpec, loadAgentState, saveAgentState } from './agent-registry.mjs';
import { checkBudget } from './budget-tracker.mjs';
import { evaluatePolicy } from './policy-engine.mjs';
import { executeAgentTaskCore } from './agent-executor.mjs';
import { repoRoot } from '../../util.mjs';

/**
 * Agent Runtime — wave-based DAG execution for multi-agent tasks.
 *
 * Core functions:
 *   executeAgentTask(options) — Execute a single task via shared agent-executor core
 *   executeWave(options)      — Execute a wave of tasks in parallel (Promise.allSettled)
 *   executeDAG(options)       — Execute entire plan as DAG waves
 *   detectConflicts(tasks)    — Detect file conflicts between parallel tasks
 */

/**
 * Execute a single agent task.
 * Delegates to the shared agent-executor core for real execution.
 *
 * @param {object} options
 * @param {string} options.taskId — Task ID
 * @param {string} options.featureSlug — Feature slug
 * @param {string} options.roleId — Agent role
 * @param {object} options.task — Full task object from Plan.json
 * @param {boolean} [options.simulate=true] — Simulate mode (no real LLM)
 * @returns {object} { taskId, roleId, status, artifact, durationMs, error? }
 */
export async function executeAgentTask(options) {
  const { taskId, featureSlug, roleId, task, simulate = true } = options;
  const root = repoRoot();
  const startTime = Date.now();

  emitAudit('agent.task.started', { taskId, featureSlug, roleId }, {
    feature: featureSlug,
    tags: ['agent', 'task'],
  });

  // Delegate to the shared executor core
  const result = await executeAgentTaskCore(root, {
    featureSlug,
    taskId,
    roleId,
    dryRun: false,
    simulate,
    taskSpec: task ? {
      name: task.name || taskId,
      description: task.description || `Execute task "${taskId}"`,
      output: task.output || { files: (task.outputs || []).map(p => ({ path: p, content: '' })) },
    } : null,
  });

  // Store artifact on success
  let artifact = null;
  if (result.success) {
    artifact = storeArtifact(taskId, featureSlug, {
      files: result.files || [],
      metadata: {
        roleId: result.roleId,
        model: result.model,
        tier: result.tier,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
      },
    });

    // Update agent state
    try {
      const agentState = loadAgentState(result.roleId || roleId);
      agentState.tasksCompleted = (agentState.tasksCompleted || 0) + 1;
      agentState.lastActiveAt = new Date().toISOString();
      agentState.lastAction = taskId;
      saveAgentState(result.roleId || roleId, agentState);
    } catch { /* best-effort */ }
  }

  const durationMs = Date.now() - startTime;

  emitAudit(`agent.task.${result.success ? 'completed' : 'failed'}`, {
    taskId, featureSlug, roleId: result.roleId || roleId,
    status: result.status, durationMs,
    model: result.model, tier: result.tier,
    simulate,
  }, {
    feature: featureSlug,
    tags: ['agent', 'task'],
  });

  return {
    taskId,
    roleId: result.roleId || roleId,
    status: result.success ? 'success' : result.status,
    artifact,
    durationMs,
    tokensUsed: result.tokensUsed,
    cost: result.cost,
    error: result.error,
  };
}

/**
 * Execute a single wave of tasks in parallel (Promise.allSettled).
 */
export async function executeWave(options) {
  const { waveIndex, taskIds, featureSlug, allocations, tasks = [], dryRun = false } = options;
  const startTime = Date.now();

  // Detect conflicts before execution
  const waveTasks = tasks.filter(t => taskIds.includes(t.id));
  const conflicts = detectConflicts(waveTasks);
  if (conflicts.length > 0) {
    emitAudit('wave.conflicts', { waveIndex, featureSlug, conflicts }, {
      feature: featureSlug,
      severity: 'warn',
    });
  }

  // Build promise array for parallel execution
  const taskPromises = taskIds.map(async (taskId) => {
    const alloc = allocations.find(a => a.taskId === taskId);
    const roleId = alloc?.roleId || 'backend-dev';
    const task = tasks.find(t => t.id === taskId);

    return executeAgentTask({
      taskId,
      featureSlug,
      roleId,
      task: task || { id: taskId, outputs: [] },
      simulate: dryRun,
    });
  });

  // Execute all tasks in wave concurrently
  const results = await Promise.allSettled(taskPromises);

  const completed = [];
  const failedTasks = [];

  for (let i = 0; i < results.length; i++) {
    const taskId = taskIds[i];
    const alloc = allocations.find(a => a.taskId === taskId);
    const roleId = alloc?.roleId || 'backend-dev';

    if (results[i].status === 'fulfilled') {
      const result = results[i].value;
      if (result.status === 'success') {
        completed.push({ taskId, roleId, status: 'success' });
      } else {
        failedTasks.push({ taskId, roleId, error: result.error || result.status });
      }
    } else {
      failedTasks.push({ taskId, roleId, error: results[i].reason?.message || 'Unknown error' });
    }
  }

  const durationMs = Date.now() - startTime;

  emitAudit('wave.completed', {
    featureSlug, waveIndex,
    taskCount: taskIds.length,
    completed: completed.length,
    failed: failedTasks.length,
    durationMs, dryRun,
    parallel: true,
  });

  return { waveIndex, completed, failed: failedTasks, durationMs };
}

/**
 * Execute an entire plan as a DAG of waves.
 */
export async function executeDAG(options) {
  const { featureSlug, tasks, dryRun = false } = options;

  const dagTasks = tasks.map(t => ({
    taskId: t.id,
    blockedBy: t.dependsOn || [],
  }));
  const dag = buildDAG(dagTasks);

  if (!dag.valid) {
    throw new Error(`Invalid DAG: ${dag.error}`);
  }

  const allocations = allocatePlan(tasks);

  emitAudit('dag.execution.started', {
    featureSlug,
    taskCount: tasks.length,
    waveCount: dag.waves.length,
    dryRun,
  });

  const waveResults = [];
  let totalCompleted = 0;
  let totalFailed = 0;

  for (let i = 0; i < dag.waves.length; i++) {
    const waveTaskIds = dag.waves[i];
    const result = await executeWave({
      waveIndex: i,
      taskIds: waveTaskIds,
      featureSlug,
      allocations,
      tasks,
      dryRun,
    });
    waveResults.push(result);
    totalCompleted += result.completed.length;
    totalFailed += result.failed.length;

    // Stop on failure in non-dry-run mode
    if (result.failed.length > 0 && !dryRun) {
      break;
    }
  }

  emitAudit('dag.execution.completed', {
    featureSlug,
    tasksCompleted: totalCompleted,
    tasksFailed: totalFailed,
    wavesExecuted: waveResults.length,
    dryRun,
  });

  return {
    waves: dag.waves,
    allocations,
    waveResults,
    tasksCompleted: totalCompleted,
    tasksFailed: totalFailed,
  };
}

/**
 * Detect file conflicts between parallel tasks.
 * Two tasks conflict if they write to the same output file.
 */
export function detectConflicts(tasks) {
  const fileToTasks = new Map();
  for (const task of tasks) {
    for (const output of (task.outputs || [])) {
      if (!fileToTasks.has(output)) fileToTasks.set(output, []);
      fileToTasks.get(output).push(task.id);
    }
  }

  const conflicts = [];
  for (const [file, taskIds] of fileToTasks) {
    if (taskIds.length > 1) {
      conflicts.push({ file, tasks: taskIds });
    }
  }
  return conflicts;
}
