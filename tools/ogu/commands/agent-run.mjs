import { repoRoot } from '../util.mjs';
import { executeAgentTaskCore } from './lib/agent-executor.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContext } from './context-store.mjs';
import { createSession, completeSession } from './session-cmd.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu agent:run --feature <slug> --task <taskId> [--dry-run] [--role <roleId>]
 *                [--simulate-failure N] [--tier <tier>] [--simulate] [--context <key>]
 *
 * Standalone agent execution (Milestone 1 — no daemon).
 * Delegates to the shared agent-executor core.
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { dryRun: false, simulate: false, feature: null, task: null, role: null, risk: null, touches: [], simulateFailure: 0, tier: null, contextKeys: [] };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') result.dryRun = true;
    else if (args[i] === '--simulate') result.simulate = true;
    else if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
    else if (args[i] === '--role' && args[i + 1]) result.role = args[++i];
    else if (args[i] === '--risk' && args[i + 1]) result.risk = args[++i];
    else if (args[i] === '--touches' && args[i + 1]) result.touches = args[++i].split(',');
    else if (args[i] === '--simulate-failure' && args[i + 1]) result.simulateFailure = parseInt(args[++i]);
    else if (args[i] === '--tier' && args[i + 1]) result.tier = args[++i];
    else if (args[i] === '--context' && args[i + 1]) result.contextKeys.push(args[++i]);
  }
  return result;
}

export async function agentRun() {
  const { dryRun, simulate, feature, task, role, risk, touches, simulateFailure, tier, contextKeys } = parseArgs();

  if (!feature || !task) {
    console.error('Usage: ogu agent:run --feature <slug> --task <taskId> [--dry-run] [--role <roleId>]');
    return 1;
  }

  const root = repoRoot();

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
  const planPath = join(root, `docs/vault/features/${feature}/Plan.json`);
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
  const result = await executeAgentTaskCore(root, {
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
  });

  // Complete session
  completeSession(session.sessionId);

  // Report results
  if (result.success) {
    console.log(`[ogu] Done. Task "${task}" ${dryRun ? '(dry-run) ' : ''}completed.`);
    if (result.attempts > 1) console.log(`[ogu] Succeeded on attempt ${result.attempts} (tier: ${result.tier})`);
    console.log(`[ogu] Model: ${result.model} | Tokens: ${result.tokensUsed?.total || 0} | Cost: $${(result.cost || 0).toFixed(4)} | Duration: ${result.durationMs}ms`);
    return 0;
  } else {
    console.error(`[ogu] Task "${task}" failed: ${result.status} — ${result.error}`);
    return 1;
  }
}
