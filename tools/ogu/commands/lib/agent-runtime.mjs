import { buildDAG } from './dag-builder.mjs';
import { allocatePlan } from './task-allocator.mjs';
import { storeArtifact, loadArtifacts } from './artifact-store.mjs';
import { emitAudit } from './audit-emitter.mjs';
import { loadOrgSpec, loadAgentState, saveAgentState } from './agent-registry.mjs';
import { checkBudget } from './budget-tracker.mjs';
import { evaluatePolicy } from './policy-engine.mjs';
import { executeAgentTaskCore } from './agent-executor.mjs';
import { repoRoot } from '../../util.mjs';
import { callLLM } from './llm-client.mjs';
import { buildPrompt } from './prompt-builder.mjs';
import { parseResponse } from './response-parser.mjs';
import { createHandoffProtocol } from './handoff-protocol.mjs';
import { createArtifactHandoff } from './artifact-handoff.mjs';

// ── Phase 4A: Feature Isolation ──
import { checkEnvelope, recordSpend, recordFailure, resetConsecutiveFailures } from './feature-isolation.mjs';

// ── Phase 4C: Sandbox Security ──
import { resolveSandboxPolicy, buildSandboxEnv } from './sandbox-policy.mjs';
import { createSandboxIsolator } from './sandbox-isolator.mjs';

// Shared sandbox isolator for task execution contexts
const _sandboxIsolator = createSandboxIsolator();

// Shared handoff managers for cross-task coordination within a DAG execution
const _handoffProtocol = createHandoffProtocol();
const _artifactHandoff = createArtifactHandoff();

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
 * @param {boolean} [options.simulate=false] — Simulate mode (no real LLM)
 * @returns {object} { taskId, roleId, status, artifact, durationMs, error? }
 */
export async function executeAgentTask(options) {
  const { taskId, featureSlug, roleId, task, simulate: simulateRequested = false } = options;
  const simulate = false;
  if (simulateRequested) {
    console.warn(`[runtime] simulate requested for ${taskId} but disabled — forcing real API call`);
  }
  const root = repoRoot();
  const startTime = Date.now();

  emitAudit('agent.task.started', { taskId, featureSlug, roleId }, {
    feature: featureSlug,
    tags: ['agent', 'task'],
  });

  // ── Feature Isolation: check envelope BEFORE execution ──
  const envelopeCheck = checkEnvelope(root, featureSlug, {
    taskCost: task?.estimatedCost || 0,
    resourceType: 'model_call',
    filesTouch: (task?.outputs || []).map(p => (typeof p === 'string' ? p : p?.path)).filter(Boolean),
  });
  if (!envelopeCheck.allowed) {
    const violation = envelopeCheck.violations[0]?.error || 'Feature envelope violation';
    emitAudit('agent.task.envelope_blocked', { taskId, featureSlug, roleId, violations: envelopeCheck.violations }, {
      feature: featureSlug,
      severity: 'error',
    });
    recordFailure(root, featureSlug, { consecutive: true });
    return {
      taskId,
      roleId,
      status: 'blocked',
      artifact: null,
      durationMs: Date.now() - startTime,
      error: violation,
    };
  }

  // ── Phase 4C: Build sandbox environment for this role ──
  let sandboxId = null;
  try {
    const sandboxEnv = buildSandboxEnv(root, roleId, 'medium');
    sandboxId = _sandboxIsolator.create(`task-${taskId}`, { env: sandboxEnv.env });
    emitAudit('agent.task.sandbox_created', {
      taskId, featureSlug, roleId,
      isolationLevel: sandboxEnv.isolationLevel,
      policy: sandboxEnv.policy,
    }, { feature: featureSlug, tags: ['sandbox'] });
  } catch { /* sandbox creation best-effort — execution proceeds */ }

  // Build structured prompt for this task (used by executor and for audit)
  const promptPayload = task ? buildPrompt({
    role: roleId,
    taskName: task.name || taskId,
    taskDescription: task.description || `Execute task "${taskId}"`,
    featureSlug,
    files: (task.outputs || []).map(p => ({ path: p, role: 'write' })),
    contextFiles: [],
  }) : null;

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

  // Parse the raw LLM response through response-parser for structured output
  // (agent-executor already does this internally, but we capture it here for runtime metadata)
  if (result.success && result.files && result.files.length > 0) {
    const parsed = parseResponse({
      content: '',
      files: result.files,
      usage: { inputTokens: result.tokensUsed?.input || 0, outputTokens: result.tokensUsed?.output || 0 },
    });
    // Attach parsed metadata to result for downstream consumers
    result._parsed = parsed;
  }

  // ── Feature Isolation: record outcome ──
  if (result.success) {
    resetConsecutiveFailures(root, featureSlug);
    if (result.cost > 0) recordSpend(root, featureSlug, result.cost);
  } else {
    recordFailure(root, featureSlug, { consecutive: true });
  }

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

  // ── Phase 4C: Destroy sandbox after execution ──
  if (sandboxId !== null) {
    try { _sandboxIsolator.destroy(sandboxId); } catch { /* best-effort */ }
  }

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

    // Handoff artifacts from completed tasks to downstream tasks via artifact-handoff
    if (result.completed.length > 0 && i < dag.waves.length - 1) {
      const nextWaveTaskIds = dag.waves[i + 1];
      for (const done of result.completed) {
        for (const nextTaskId of nextWaveTaskIds) {
          // Check if next task depends on the completed one
          const nextTask = tasks.find(t => t.id === nextTaskId);
          if (nextTask?.dependsOn?.includes(done.taskId)) {
            // Initiate handoff protocol for agent-to-agent transfer
            _handoffProtocol.initiateHandoff({
              fromAgent: done.roleId,
              toAgent: allocations.find(a => a.taskId === nextTaskId)?.roleId || 'backend-dev',
              taskId: nextTaskId,
              context: { previousTaskId: done.taskId, waveIndex: i },
            });
            // Send artifact via artifact-handoff
            _artifactHandoff.send({
              from: done.roleId,
              to: allocations.find(a => a.taskId === nextTaskId)?.roleId || 'backend-dev',
              artifact: { taskId: done.taskId, featureSlug },
              message: `Output from task ${done.taskId} (wave ${i})`,
            });
          }
        }
      }
    }

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
