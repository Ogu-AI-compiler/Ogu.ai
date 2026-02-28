import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { buildDAG } from './lib/dag-builder.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';
import { enqueueTask } from './lib/scheduler.mjs';

/**
 * ogu build:dispatch <slug> — Read Plan.json, build DAG, enqueue tasks to Kadima.
 *
 * This is the bridge between the Ogu compiler pipeline and the Kadima daemon.
 * Instead of building inline, it delegates work to background runners.
 *
 * Uses the formal scheduler's enqueueTask() to ensure tasks get proper
 * priority, teamId, and WFQ scheduling fields.
 */
export async function buildDispatch() {
  const slug = process.argv[3];

  if (!slug) {
    console.error('Usage: ogu build:dispatch <feature-slug>');
    return 1;
  }

  const root = repoRoot();

  // Find Plan.json
  const planPath = join(root, `docs/vault/features/${slug}/Plan.json`);
  if (!existsSync(planPath)) {
    console.error(`Plan.json not found: ${planPath}`);
    return 1;
  }

  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const tasks = plan.tasks || [];

  if (tasks.length === 0) {
    console.error('Plan.json has no tasks.');
    return 1;
  }

  // Validate DAG
  const dagTasks = tasks.map(t => ({
    taskId: t.id,
    blockedBy: (t.dependsOn || []),
  }));
  const dag = buildDAG(dagTasks);

  if (!dag.valid) {
    console.error(`Invalid DAG: ${dag.error}`);
    return 1;
  }

  // Resolve teamId from OrgSpec (role → team mapping)
  const teamForRole = resolveTeamMap(root);

  // Load feature state to register tasks
  const featureStatePath = join(root, `.ogu/state/features/${slug}.state.json`);
  let featureState = null;
  if (existsSync(featureStatePath)) {
    featureState = JSON.parse(readFileSync(featureStatePath, 'utf8'));
    if (!featureState.tasks) featureState.tasks = [];
  }

  // Enqueue each task via the formal scheduler
  let enqueued = 0;
  for (const task of tasks) {
    const blockedBy = (task.dependsOn || []);
    const roleId = task.role || task.assignedRole || null;
    const teamId = roleId ? (teamForRole[roleId] || null) : null;

    // Determine priority from task risk tier
    const priority = taskPriorityFromRisk(task.riskTier || 'medium');

    const result = enqueueTask(root, {
      taskId: task.id,
      featureSlug: slug,
      priority,
      estimatedCost: task.estimatedCost || 0,
      resourceType: task.resourceType || 'model_call',
      blockedBy,
      teamId,
      taskSpec: {
        name: task.name,
        description: task.description,
        output: task.output || {},
      },
    });

    if (result.enqueued) {
      // Register on feature state
      if (featureState && !featureState.tasks.find(t => t.taskId === task.id)) {
        featureState.tasks.push({ taskId: task.id, status: 'pending' });
      }
      enqueued++;
    }
  }

  if (featureState) {
    featureState.updatedAt = new Date().toISOString();
    writeFileSync(featureStatePath, JSON.stringify(featureState, null, 2), 'utf8');
  }

  emitAudit('build.dispatch', {
    featureSlug: slug,
    taskCount: enqueued,
    waves: dag.waves.length,
    taskIds: tasks.map(t => t.id),
  });

  console.log(`Dispatched ${enqueued} tasks for "${slug}" (${dag.waves.length} waves)`);
  for (let i = 0; i < dag.waves.length; i++) {
    console.log(`  Wave ${i}: ${dag.waves[i].join(', ')}`);
  }
  return 0;
}

/**
 * Build a roleId → teamId map from OrgSpec.
 */
function resolveTeamMap(root) {
  const map = {};
  const orgPath = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(orgPath)) return map;
  try {
    const org = JSON.parse(readFileSync(orgPath, 'utf8'));
    for (const team of (org.teams || [])) {
      for (const roleId of (team.roles || [])) {
        map[roleId] = team.teamId;
      }
    }
  } catch { /* skip */ }
  return map;
}

/**
 * Map risk tier to scheduler priority.
 */
function taskPriorityFromRisk(riskTier) {
  switch (riskTier) {
    case 'critical': return 90;
    case 'high': return 70;
    case 'medium': return 50;
    case 'low': return 20;
    default: return 50;
  }
}
