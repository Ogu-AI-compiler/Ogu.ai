import { repoRoot } from '../util.mjs';
import { executeAgentTaskCore } from './lib/agent-executor.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContext } from './context-store.mjs';
import { createSession, completeSession } from './session-cmd.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';
import { createAgentController } from './lib/agent-controller.mjs';
import { createAgentManager } from './lib/agent-lifecycle.mjs';
import { createAgentStatePersistence } from './lib/agent-state-persistence.mjs';
import { createAgentExecutionContext } from './lib/agent-execution-context.mjs';
import { createMemoryScope } from './lib/memory-scope.mjs';
import { buildBranchName, buildCommitMessage } from './lib/git-operations.mjs';
import { createWorktreeCreator } from './lib/worktree-creator.mjs';

/**
 * ogu agent:run --feature <slug> --task <taskId> [--dry-run] [--role <roleId>]
 *                [--simulate-failure N] [--tier <tier>] [--simulate] [--context <key>]
 *
 * Standalone agent execution (Milestone 1 — no daemon).
 * Delegates to the shared agent-executor core.
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { dryRun: false, simulate: false, feature: null, task: null, role: null, risk: null, touches: [], simulateFailure: 0, tier: null, contextKeys: [], fixNote: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') result.dryRun = true;
    else if (args[i] === '--simulate') result.simulate = true;
    else if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
    else if (args[i] === '--role' && args[i + 1]) result.role = args[++i];
    else if (args[i] === '--risk' && args[i + 1]) result.risk = args[++i];
    else if (args[i] === '--touches' && args[i + 1]) result.touches = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (args[i] === '--simulate-failure' && args[i + 1]) result.simulateFailure = parseInt(args[++i]);
    else if (args[i] === '--tier' && args[i + 1]) result.tier = args[++i];
    else if (args[i] === '--context' && args[i + 1]) result.contextKeys.push(args[++i]);
    else if (args[i] === '--fix-note' && args[i + 1]) result.fixNote = args[++i];
  }
  return result;
}

export async function runAgentTask(options = {}) {
  const {
    dryRun = false,
    simulate: simulateRequested = false,
    feature = null,
    task = null,
    role = null,
    risk = null,
    touches = [],
    simulateFailure = 0,
    tier = null,
    contextKeys = [],
    fixNote = null,
    root = null,
  } = options || {};
  const simulate = false;
  if (simulateRequested) {
    console.warn('[ogu] --simulate requested but disabled — forcing real API call');
  }

  if (!feature || !task) {
    console.error('Usage: ogu agent:run --feature <slug> --task <taskId> [--dry-run] [--role <roleId>]');
    return { exitCode: 1, result: null, error: 'Missing feature or task' };
  }

  const resolvedRoot = root || repoRoot();

  // --- Phase 2B: Agent Lifecycle Setup ---
  const controller = createAgentController();
  const agentManager = createAgentManager({ root: resolvedRoot });
  const statePersistence = createAgentStatePersistence({
    dir: join(resolvedRoot, '.ogu/agents/state'),
  });
  const worktreeCreator = createWorktreeCreator({ repoRoot: resolvedRoot, dryRun });

  // Register and spawn agent in controller + lifecycle manager
  const agentId = `${role || 'auto'}-${feature}-${task}`;
  controller.register(agentId, { role: role || 'default' });
  controller.start(agentId);
  const managedAgent = agentManager.spawn({
    roleId: role || 'default',
    taskId: task,
    featureSlug: feature,
  });

  // Build execution context with scoped memory
  const execCtx = createAgentExecutionContext({
    agentId: managedAgent.agentId,
    taskId: task,
    feature,
    phase: 'build',
  });
  const memoryScope = createMemoryScope({
    allowedScopes: [feature, 'shared', role || 'default'],
  });

  // Compute git branch name for this agent task
  const branchName = buildBranchName({ agentId: managedAgent.agentId, feature, taskId: task });
  execCtx.set('branchName', branchName);
  execCtx.set('commitMessageTemplate', buildCommitMessage({
    agentId: managedAgent.agentId,
    taskId: task,
    description: 'task execution',
  }));

  // Plan worktree (dry-run safe — does not create on disk unless needed)
  const worktreePlan = worktreeCreator.plan({ agentId: managedAgent.agentId, taskId: task, feature });
  execCtx.set('worktreePlan', worktreePlan);

  // Load persisted agent state for this role
  const priorState = await statePersistence.load(role || 'default');
  execCtx.set('priorState', priorState);

  // Load handoff context
  let handoffContext = null;
  if (contextKeys.length > 0) {
    handoffContext = {};
    for (const key of contextKeys) {
      const val = loadContext(feature, key);
      if (val) {
        handoffContext[key] = val;
        console.log(`[ogu] Handoff context loaded: ${key}`);
      }
    }
    const fromRole = contextKeys[0]?.split('.')[0];
    if (fromRole && role) {
      emitAudit('agent.handoff', {
        featureSlug: feature, taskId: task, fromRole, toRole: role, contextKeys,
      }, { feature: { slug: feature, taskId: task } });
    }
  }

  // Load task spec from Plan.json
  let taskSpec = null;
  const planPath = existsSync(join(resolvedRoot, `docs/vault/04_Features/${feature}/Plan.json`))
    ? join(resolvedRoot, `docs/vault/04_Features/${feature}/Plan.json`)
    : join(resolvedRoot, `docs/vault/features/${feature}/Plan.json`);
  if (existsSync(planPath)) {
    try {
      const plan = JSON.parse(readFileSync(planPath, 'utf8'));
      taskSpec = plan.tasks?.find(t => t.id === task);
    } catch { /* skip */ }
  }

  // Create session
  const session = createSession({
    featureSlug: feature, taskId: task, roleId: role || 'default',
    model: 'pending', provider: 'pending',
  });

  console.log(`[ogu] Agent: ${role || 'auto'} | Feature: ${feature} | Task: ${task}`);
  if (dryRun) console.log(`[ogu] DRY RUN mode`);
  if (simulate) console.log(`[ogu] SIMULATE mode`);

  // Execute via shared core
  const result = await executeAgentTaskCore(resolvedRoot, {
    featureSlug: feature,
    taskId: task,
    roleId: role,
    tier,
    dryRun,
    simulate,
    simulateFailure,
    riskTier: risk,
    touches,
    taskSpec,
    handoffContext,
    fixNote,
  });

  // Complete session
  completeSession(session.sessionId);

  // --- Phase 2B: Post-execution lifecycle updates ---
  execCtx.recordMetric('durationMs', result.durationMs || 0);
  execCtx.recordMetric('tokensUsed', result.tokensUsed?.total || 0);
  execCtx.recordMetric('cost', result.cost || 0);

  if (result.success) {
    controller.stop(agentId);
    agentManager.shutdown(managedAgent.agentId, { reason: 'completed' });
    await statePersistence.update(role || 'default', {
      lastActive: new Date().toISOString(),
      tasksCompleted: (priorState.tasksCompleted || 0) + 1,
      tokensUsedToday: (priorState.tokensUsedToday || 0) + (result.tokensUsed?.total || 0),
    });
  } else {
    controller.fail(agentId);
    agentManager.shutdown(managedAgent.agentId, { reason: result.error || 'failed' });
    await statePersistence.update(role || 'default', {
      lastActive: new Date().toISOString(),
      tasksFailed: (priorState.tasksFailed || 0) + 1,
      tokensUsedToday: (priorState.tokensUsedToday || 0) + (result.tokensUsed?.total || 0),
    });
  }

  // Write scoped memory entry for this run
  try {
    memoryScope.write(feature, `${task}:result`, {
      success: result.success,
      model: result.model,
      durationMs: result.durationMs,
      metrics: execCtx.getMetrics(),
    });
  } catch { /* scope write is best-effort */ }

  // Report results
  if (result.success) {
    console.log(`[ogu] Done. Task "${task}" ${dryRun ? '(dry-run) ' : ''}completed.`);
    if (result.attempts > 1) console.log(`[ogu] Succeeded on attempt ${result.attempts} (tier: ${result.tier})`);
    console.log(`[ogu] Model: ${result.model} | Tokens: ${result.tokensUsed?.total || 0} | Cost: $${(result.cost || 0).toFixed(4)} | Duration: ${result.durationMs}ms`);
    return { exitCode: 0, result, error: null };
  } else {
    console.error(`[ogu] Task "${task}" failed: ${result.status} — ${result.error}`);
    return { exitCode: 1, result, error: result.error || 'Task failed' };
  }
}

export async function agentRun() {
  const args = parseArgs();
  const { exitCode } = await runAgentTask({ ...args, root: repoRoot() });
  return exitCode;
}
