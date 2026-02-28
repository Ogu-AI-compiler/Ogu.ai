import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { allocateTask, allocatePlan } from './lib/task-allocator.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu task:allocate --feature <slug> --task <taskId> [--json]
 * ogu task:allocate-plan --feature <slug> [--json]
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { feature: null, task: null, json: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--task' && args[i + 1]) result.task = args[++i];
    else if (args[i] === '--json') result.json = true;
  }

  return result;
}

function loadPlan(slug) {
  const root = repoRoot();
  const planPath = join(root, `docs/vault/features/${slug}/Plan.json`);
  if (!existsSync(planPath)) return null;
  return JSON.parse(readFileSync(planPath, 'utf8'));
}

export async function taskAllocate() {
  const args = parseArgs();

  if (!args.feature || !args.task) {
    console.error('Usage: ogu task:allocate --feature <slug> --task <taskId> [--json]');
    return 1;
  }

  const plan = loadPlan(args.feature);
  if (!plan) {
    console.error(`Plan.json not found for feature "${args.feature}"`);
    return 1;
  }

  const task = plan.tasks?.find(t => t.id === args.task);
  if (!task) {
    console.error(`Task "${args.task}" not found in Plan.json for "${args.feature}"`);
    return 1;
  }

  const alloc = allocateTask({
    taskId: task.id,
    requiredCapabilities: task.requiredCapabilities || [],
    riskTier: task.riskTier,
  });

  if (!alloc) {
    console.error(`No matching agent role for task "${args.task}" (needs: ${(task.requiredCapabilities || []).join(', ')})`);
    return 1;
  }

  emitAudit('task.allocated', {
    featureSlug: args.feature,
    taskId: task.id,
    roleId: alloc.roleId,
    capabilities: alloc.capabilities,
  });

  if (args.json) {
    console.log(JSON.stringify(alloc, null, 2));
  } else {
    console.log(`Allocated "${task.id}" → ${alloc.roleId} (${alloc.roleName})`);
    console.log(`  Capabilities: ${alloc.capabilities.join(', ')}`);
    console.log(`  Risk: ${alloc.riskTier} | Max tokens: ${alloc.maxTokensPerTask}`);
  }

  return 0;
}

export async function taskAllocatePlan() {
  const args = parseArgs();

  if (!args.feature) {
    console.error('Usage: ogu task:allocate-plan --feature <slug> [--json]');
    return 1;
  }

  const plan = loadPlan(args.feature);
  if (!plan) {
    console.error(`Plan.json not found for feature "${args.feature}"`);
    return 1;
  }

  const tasks = plan.tasks || [];
  if (tasks.length === 0) {
    console.error('Plan.json has no tasks.');
    return 1;
  }

  const allocations = allocatePlan(tasks);

  emitAudit('plan.allocated', {
    featureSlug: args.feature,
    taskCount: tasks.length,
    allocations: allocations.map(a => ({ taskId: a.taskId, roleId: a.roleId })),
  });

  if (args.json) {
    console.log(JSON.stringify(allocations, null, 2));
  } else {
    console.log(`Allocated ${allocations.length} tasks for "${args.feature}":\n`);
    for (const a of allocations) {
      if (a.roleId) {
        console.log(`  ${a.taskId.padEnd(24)} → ${a.roleId} (${a.roleName})`);
      } else {
        console.log(`  ${a.taskId.padEnd(24)} → UNASSIGNED (${a.error})`);
      }
    }
  }

  return 0;
}
