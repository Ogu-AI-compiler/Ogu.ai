import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { loadOrgSpec, matchRole } from './lib/agent-registry.mjs';
import { detectCapability, resolveCapability } from './lib/capability-registry.mjs';
import { enqueueTask } from './lib/scheduler.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu kadima:allocate <slug> [--dry-run] [--enqueue]
 *
 * Read Plan.json for <slug>, match each task to a role via capability registry,
 * check governance, write allocations.json.
 *
 * --dry-run: show allocations without writing
 * --enqueue: also enqueue allocated tasks into the scheduler
 */
export async function kadimaAllocate() {
  const args = process.argv.slice(3);
  const slug = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const enqueue = args.includes('--enqueue');

  if (!slug) {
    console.error('Usage: ogu kadima:allocate <slug> [--dry-run] [--enqueue]');
    return 1;
  }

  const root = repoRoot();

  // Load Plan.json
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  if (!existsSync(planPath)) {
    console.error(`Plan.json not found for "${slug}". Run /architect first.`);
    return 1;
  }
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const tasks = plan.tasks || [];

  if (tasks.length === 0) {
    console.error('Plan.json has no tasks.');
    return 1;
  }

  // Load OrgSpec
  const orgSpec = loadOrgSpec(root);
  if (!orgSpec) {
    console.error('OrgSpec.json not found. Run: ogu org:init');
    return 1;
  }

  // Determine feature phase (from state or plan)
  const phase = plan.metadata?.phase || 'build';

  // Allocate each task to a role
  const allocations = [];
  const errors = [];

  console.log(`\n  Allocating ${tasks.length} tasks for "${slug}" (phase: ${phase})\n`);

  for (const task of tasks) {
    const taskId = task.id || task.taskId;
    const taskName = task.name || task.title || taskId;

    // Detect required capability
    const capabilityId = detectCapability(task, phase);

    // Find best role for this capability
    const role = matchRole(orgSpec, { capability: capabilityId, phase, riskTier: task.riskTier });

    if (!role) {
      errors.push({ taskId, error: `No role with capability '${capabilityId}'` });
      console.log(`  SKIP  ${taskId.padEnd(28)} — no role for ${capabilityId}`);
      continue;
    }

    // Resolve model via capability registry
    const resolution = resolveCapability(root, {
      roleId: role.roleId,
      capabilityId,
      budgetTier: 3,
    });

    const allocation = {
      taskId,
      taskName,
      roleId: role.roleId,
      roleName: role.name,
      capabilityId,
      provider: resolution.resolved ? resolution.provider : 'anthropic',
      model: resolution.resolved ? resolution.model : (role.modelPolicy?.default || 'claude-sonnet-4-6'),
      tier: resolution.resolved ? resolution.tier : 2,
      dependencies: task.dependencies || task.blockedBy || [],
      estimatedCost: task.estimatedCost || 0,
      priority: task.priority || 50,
    };

    if (resolution.warning) {
      allocation.warning = resolution.warning;
    }

    allocations.push(allocation);

    const icon = resolution.partial ? '~' : '✓';
    const warn = resolution.warning ? ` (${resolution.warning})` : '';
    console.log(`  ${icon}  ${taskId.padEnd(28)} → ${role.roleId.padEnd(16)} ${allocation.model}${warn}`);
  }

  if (errors.length > 0) {
    console.log(`\n  ${errors.length} tasks could not be allocated.`);
  }

  console.log(`\n  Allocated: ${allocations.length}/${tasks.length} tasks`);

  // Write allocations.json
  if (!dryRun && allocations.length > 0) {
    const allocationDoc = {
      $schema: 'Allocations/1.0',
      featureSlug: slug,
      phase,
      allocatedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      allocated: allocations.length,
      skipped: errors.length,
      allocations,
      errors: errors.length > 0 ? errors : undefined,
    };

    const allocPath = join(root, `docs/vault/04_Features/${slug}/allocations.json`);
    writeFileSync(allocPath, JSON.stringify(allocationDoc, null, 2), 'utf8');
    console.log(`  Written: allocations.json`);

    emitAudit('kadima.allocated', {
      featureSlug: slug,
      totalTasks: tasks.length,
      allocated: allocations.length,
      skipped: errors.length,
    }, { feature: { slug } });

    // Enqueue into scheduler if requested
    if (enqueue) {
      console.log('');
      for (const alloc of allocations) {
        const result = enqueueTask(root, {
          taskId: alloc.taskId,
          featureSlug: slug,
          priority: alloc.priority,
          estimatedCost: alloc.estimatedCost,
          blockedBy: alloc.dependencies,
          roleId: alloc.roleId,
          teamId: orgSpec.roles.find(r => r.roleId === alloc.roleId)?.department,
        });
        if (result.enqueued) {
          console.log(`  Enqueued: ${alloc.taskId} (pos ${result.position})`);
        }
      }
    }
  }

  console.log('');
  return errors.length > 0 ? 1 : 0;
}
