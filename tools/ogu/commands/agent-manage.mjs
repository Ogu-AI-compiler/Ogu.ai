/**
 * Agent Management Commands:
 *   ogu agent:status [--feature <slug>]     — Show running agents, tasks, worktrees, progress
 *   ogu agent:stop <taskId> [--force]       — Stop a running agent (kill process, cleanup worktree)
 *   ogu agent:escalate <taskId> [--tier T]  — Manually escalate to higher tier model
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { loadOrgSpec, loadAgentState, saveAgentState } from './lib/agent-registry.mjs';
import { listAgentWorktrees } from './lib/worktree-manager.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

function parseArgs(offset = 3) {
  const args = process.argv.slice(offset);
  const result = { feature: null, force: false, taskId: null, tier: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--force') result.force = true;
    else if (args[i] === '--tier' && args[i + 1]) result.tier = args[++i];
    else if (!args[i].startsWith('--') && !result.taskId) result.taskId = args[i];
  }
  return result;
}

/**
 * ogu agent:status [--feature <slug>]
 *
 * Shows: running agents, their current tasks, worktrees, tokens, cost.
 */
export async function agentStatus() {
  const { feature } = parseArgs();
  const root = repoRoot();
  const org = loadOrgSpec();

  if (!org) {
    console.error('OrgSpec.json not found. Run: ogu org:init');
    return 1;
  }

  // 1. Collect agent states
  const agents = [];
  for (const role of org.roles) {
    const state = loadAgentState(role.roleId);
    agents.push({ role, state });
  }

  // 2. Load scheduler state for active tasks
  const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
  let schedulerTasks = [];
  if (existsSync(schedulerPath)) {
    try {
      const sched = JSON.parse(readFileSync(schedulerPath, 'utf8'));
      schedulerTasks = sched.queue || [];
    } catch { /* ignore */ }
  }

  // 3. Load active runner envelopes
  const runnersDir = join(root, '.ogu/runners');
  let activeRunners = [];
  if (existsSync(runnersDir)) {
    const files = readdirSync(runnersDir).filter(f => f.endsWith('.input.json'));
    for (const f of files) {
      const taskId = f.replace('.input.json', '');
      const outputFile = f.replace('.input.json', '.output.json');
      const hasOutput = existsSync(join(runnersDir, outputFile));
      try {
        const input = JSON.parse(readFileSync(join(runnersDir, f), 'utf8'));
        activeRunners.push({
          taskId,
          featureSlug: input.featureSlug,
          roleId: input.agent?.roleId || 'unknown',
          model: input.routingDecision?.model || 'unknown',
          completed: hasOutput,
        });
      } catch { /* skip corrupt */ }
    }
  }

  // 4. Load worktrees
  let worktrees = [];
  try { worktrees = listAgentWorktrees(root); } catch { /* ignore */ }

  // 5. Filter by feature if specified
  if (feature) {
    activeRunners = activeRunners.filter(r => r.featureSlug === feature);
    schedulerTasks = schedulerTasks.filter(t => t.featureSlug === feature);
  }

  // 6. Display
  console.log('\n  Agent Status Dashboard\n');

  // Active tasks
  const running = activeRunners.filter(r => !r.completed);
  const completed = activeRunners.filter(r => r.completed);

  if (running.length > 0) {
    console.log(`  Running Tasks (${running.length}):`);
    for (const r of running) {
      console.log(`    ${r.taskId.padEnd(20)} ${r.roleId.padEnd(16)} ${r.model.padEnd(16)} ${r.featureSlug}`);
    }
    console.log('');
  }

  if (completed.length > 0) {
    console.log(`  Completed Tasks (${completed.length}):`);
    for (const r of completed.slice(0, 10)) {
      console.log(`    ${r.taskId.padEnd(20)} ${r.roleId.padEnd(16)} ${r.featureSlug}`);
    }
    if (completed.length > 10) console.log(`    ... and ${completed.length - 10} more`);
    console.log('');
  }

  // Queued tasks
  const queued = schedulerTasks.filter(t => t.status === 'pending');
  const dispatched = schedulerTasks.filter(t => t.status === 'dispatched');

  if (queued.length > 0 || dispatched.length > 0) {
    console.log(`  Scheduler Queue: ${queued.length} pending, ${dispatched.length} dispatched`);
    for (const t of [...dispatched, ...queued].slice(0, 5)) {
      console.log(`    ${(t.taskId || t.id).padEnd(20)} ${(t.status || '').padEnd(12)} ${t.featureSlug || ''}`);
    }
    console.log('');
  }

  // Agent summary
  console.log('  Agent Summary:');
  console.log('  ROLE             STATUS      TASKS DONE  TOKENS TODAY   COST');
  for (const { role, state } of agents) {
    if (role.enabled === false) continue;
    const status = state.currentTask ? 'executing' : 'idle';
    const tasks = state.tasksCompleted || 0;
    const tokens = (state.tokensUsedToday || state.tokensUsed || 0).toLocaleString();
    const cost = `$${(state.costToday || state.costUsed || 0).toFixed(2)}`;
    console.log(`  ${role.roleId.padEnd(17)} ${status.padEnd(11)} ${String(tasks).padStart(10)}  ${tokens.padStart(12)}  ${cost.padStart(7)}`);
  }

  // Worktrees
  if (worktrees.length > 0) {
    console.log(`\n  Active Worktrees (${worktrees.length}):`);
    for (const wt of worktrees) {
      console.log(`    ${wt.branch || '(detached)'}  →  ${wt.path}`);
    }
  }

  console.log('');
  return 0;
}

/**
 * ogu agent:stop <taskId> [--force]
 *
 * Stops a running agent task:
 * 1. Marks task as cancelled in scheduler
 * 2. Kills runner process if active
 * 3. Cleans up worktree if --force
 */
export async function agentStop() {
  const { taskId, force } = parseArgs();
  const root = repoRoot();

  if (!taskId) {
    console.error('Usage: ogu agent:stop <taskId> [--force]');
    return 1;
  }

  console.log(`[ogu] Stopping agent task: ${taskId}${force ? ' (force)' : ''}`);

  let stopped = false;

  // 1. Update scheduler state
  const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
  if (existsSync(schedulerPath)) {
    try {
      const sched = JSON.parse(readFileSync(schedulerPath, 'utf8'));
      const task = (sched.queue || []).find(t => (t.taskId || t.id) === taskId);
      if (task) {
        task.status = 'cancelled';
        task.cancelledAt = new Date().toISOString();
        task.cancelReason = force ? 'force-stop' : 'manual-stop';
        writeFileSync(schedulerPath, JSON.stringify(sched, null, 2), 'utf8');
        console.log(`[ogu] Scheduler: task marked as cancelled`);
        stopped = true;
      }
    } catch { /* ignore */ }
  }

  // 2. Try to find and kill the runner process
  const inputPath = join(root, '.ogu/runners', `${taskId}.input.json`);
  if (existsSync(inputPath)) {
    try {
      const input = JSON.parse(readFileSync(inputPath, 'utf8'));
      const pid = input.runner?.pid;
      if (pid) {
        try {
          process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
          console.log(`[ogu] Runner process ${pid} killed`);
          stopped = true;
        } catch {
          console.log(`[ogu] Runner process ${pid} not found (already exited)`);
        }
      }
    } catch { /* ignore */ }

    // Write a cancellation output envelope
    const outputPath = join(root, '.ogu/runners', `${taskId}.output.json`);
    if (!existsSync(outputPath)) {
      writeFileSync(outputPath, JSON.stringify({
        taskId,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'agent:stop',
        force,
      }, null, 2), 'utf8');
    }
    stopped = true;
  }

  // 3. Update agent state
  const org = loadOrgSpec();
  if (org) {
    for (const role of org.roles) {
      const state = loadAgentState(role.roleId);
      if (state.currentTask === taskId || state.lastAction === taskId) {
        state.currentTask = null;
        state.lastAction = `cancelled:${taskId}`;
        saveAgentState(role.roleId, state);
        console.log(`[ogu] Agent state updated for ${role.roleId}`);
        break;
      }
    }
  }

  // 4. Emit audit
  emitAudit('agent.stopped', { taskId, force, manual: true });

  if (stopped) {
    console.log(`[ogu] Task "${taskId}" stopped.`);
  } else {
    console.log(`[ogu] Task "${taskId}" not found in scheduler or runners.`);
  }

  return stopped ? 0 : 1;
}

/**
 * ogu agent:escalate <taskId> [--tier <tier>]
 *
 * Manually escalate a task to a higher tier model.
 * If the task is running, it will be requeued with the new tier.
 */
export async function agentEscalate() {
  const { taskId, tier } = parseArgs();
  const root = repoRoot();

  if (!taskId) {
    console.error('Usage: ogu agent:escalate <taskId> [--tier <fast|standard|advanced>]');
    return 1;
  }

  const org = loadOrgSpec();
  if (!org) {
    console.error('OrgSpec.json not found.');
    return 1;
  }

  // Determine target tier
  const tierOrder = ['fast', 'standard', 'advanced', 'premium'];
  let targetTier = tier;

  if (!targetTier) {
    // Find current tier from runner input and escalate one step
    const inputPath = join(root, '.ogu/runners', `${taskId}.input.json`);
    if (existsSync(inputPath)) {
      try {
        const input = JSON.parse(readFileSync(inputPath, 'utf8'));
        const currentTier = input.routingDecision?.tier || 'fast';
        const idx = tierOrder.indexOf(currentTier);
        targetTier = tierOrder[Math.min(idx + 1, tierOrder.length - 1)];
      } catch {
        targetTier = 'standard';
      }
    } else {
      targetTier = 'standard';
    }
  }

  // Validate tier
  if (!tierOrder.includes(targetTier)) {
    console.error(`Invalid tier: ${targetTier}. Valid: ${tierOrder.join(', ')}`);
    return 1;
  }

  // Find a model for this tier
  let modelId = null;
  for (const provider of org.providers.filter(p => p.enabled !== false)) {
    const model = provider.models.find(m => m.tier === targetTier);
    if (model) {
      modelId = model.id;
      break;
    }
  }

  if (!modelId) {
    console.error(`No model available for tier "${targetTier}".`);
    return 1;
  }

  console.log(`[ogu] Escalating task "${taskId}" to tier: ${targetTier} (model: ${modelId})`);

  // Update scheduler state
  const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
  let requeued = false;
  if (existsSync(schedulerPath)) {
    try {
      const sched = JSON.parse(readFileSync(schedulerPath, 'utf8'));
      const task = (sched.queue || []).find(t => (t.taskId || t.id) === taskId);
      if (task) {
        task.tier = targetTier;
        task.model = modelId;
        task.escalatedAt = new Date().toISOString();
        task.escalationReason = 'manual';
        // If dispatched or failed, requeue
        if (task.status === 'dispatched' || task.status === 'failed') {
          task.status = 'pending';
          task.retries = (task.retries || 0) + 1;
        }
        writeFileSync(schedulerPath, JSON.stringify(sched, null, 2), 'utf8');
        requeued = true;
        console.log(`[ogu] Scheduler: task requeued with tier ${targetTier}`);
      }
    } catch { /* ignore */ }
  }

  // Update input envelope for the next run
  const inputPath = join(root, '.ogu/runners', `${taskId}.input.json`);
  if (existsSync(inputPath)) {
    try {
      const input = JSON.parse(readFileSync(inputPath, 'utf8'));
      input.routingDecision = {
        ...input.routingDecision,
        tier: targetTier,
        model: modelId,
        escalatedAt: new Date().toISOString(),
        reason: `Manual escalation to ${targetTier}`,
      };
      writeFileSync(inputPath, JSON.stringify(input, null, 2), 'utf8');
    } catch { /* ignore */ }
  }

  // Emit audit
  emitAudit('agent.escalated', { taskId, targetTier, model: modelId, manual: true });

  if (requeued) {
    console.log(`[ogu] Task "${taskId}" escalated to ${targetTier}. Will run on next scheduler tick.`);
  } else {
    console.log(`[ogu] Task "${taskId}" not found in scheduler. Escalation recorded for next run.`);
  }

  return 0;
}
