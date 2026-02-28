import { repoRoot } from '../util.mjs';
import {
  getSchedulerStatus,
  getSchedulerQueue,
  loadSchedulerPolicy,
  simulateScheduling,
} from './lib/scheduler.mjs';

/**
 * ogu scheduler:status — Show scheduler state + queue + fairness.
 */
export async function schedulerStatus() {
  const root = repoRoot();
  const status = getSchedulerStatus(root);

  console.log('SCHEDULER STATUS:\n');
  console.log(`  QUEUE: ${status.totalPending} pending, ${status.totalScheduled} running, ${status.totalCompleted} completed\n`);

  // Priority class breakdown
  console.log('  CLASS            QUEUED  RUNNING  MAX WAIT     PROMOTED');
  console.log('  ─────────────── ─────── ──────── ──────────── ─────────');
  for (const [cls, data] of Object.entries(status.classCounts)) {
    const waitStr = data.maxWaitMs != null ? `${Math.round(data.maxWaitMs / 1000)}s` : '—';
    const promotedStr = data.promoted > 0 ? `${data.promoted}` : '—';
    console.log(`  ${cls.padEnd(16)} ${String(data.queued).padEnd(8)}${String(data.running).padEnd(9)}${waitStr.padEnd(13)}${promotedStr}`);
  }

  // Feature fairness
  const features = Object.entries(status.featureFairness);
  if (features.length > 0) {
    console.log('\n  FAIRNESS (virtual clocks):');
    // Find feature with lowest clock for "next scheduled" indicator
    const lowestClock = features.reduce((min, [, data]) =>
      data.queued > 0 && (min === null || data.virtualClock < min.virtualClock) ? data : min
    , null);

    for (const [slug, data] of features) {
      const isNext = lowestClock && data.virtualClock === lowestClock.virtualClock && data.queued > 0;
      const indicator = isNext ? ' ← next' : '';
      console.log(`    ${slug.padEnd(20)} │ vt: ${data.virtualClock.toFixed(1).padEnd(5)} │ weight: ${data.weight.toFixed(1)} │ ${data.running} run, ${data.queued} queued${indicator}`);
    }
  }

  // Team quotas
  const teams = Object.entries(status.teamStatus);
  if (teams.length > 0) {
    console.log('\n  TEAM QUOTAS:');
    for (const [teamId, data] of teams) {
      console.log(`    ${teamId.padEnd(14)} │ ${data.active}/${data.max} agents  │ $${data.maxDailyBudget} budget`);
    }
  }

  console.log(`\n  ALGORITHM: ${status.algorithm}`);
  return 0;
}

/**
 * ogu scheduler:queue — Show pending task queue with priorities.
 */
export async function schedulerQueue() {
  const root = repoRoot();
  const queue = getSchedulerQueue(root);

  if (queue.length === 0) {
    console.log('SCHEDULER QUEUE: empty');
    return 0;
  }

  console.log(`SCHEDULER QUEUE: ${queue.length} pending\n`);
  console.log('  TASK ID              FEATURE              PRIORITY  CLASS         WAIT      PROMOTED');
  console.log('  ──────────────────── ──────────────────── ───────── ──────────── ───────── ─────────');

  for (const task of queue) {
    const waitStr = `${Math.round(task.waitMs / 1000)}s`;
    const promotedStr = task.promotions > 0 ? `${task.promotions}x` : '—';
    const blocked = task.blockedBy.length > 0 ? ` [blocked by: ${task.blockedBy.join(', ')}]` : '';
    console.log(`  ${(task.taskId || '').padEnd(21)}${(task.featureSlug || '').padEnd(21)}${String(task.priority).padEnd(10)}${task.priorityClass.padEnd(13)}${waitStr.padEnd(10)}${promotedStr}${blocked}`);
  }
  return 0;
}

/**
 * ogu scheduler:fairness — Show virtual clocks + weight per feature.
 */
export async function schedulerFairness() {
  const root = repoRoot();
  const status = getSchedulerStatus(root);
  const features = Object.entries(status.featureFairness);

  if (features.length === 0) {
    console.log('WEIGHTED FAIR SCHEDULING: no features in queue');
    return 0;
  }

  console.log('WEIGHTED FAIR SCHEDULING:\n');
  console.log('  Feature              VirtualClock  Weight  Queued  Running');
  console.log('  ──────────────────── ──────────── ─────── ─────── ─────────');

  // Sort by virtual clock ASC
  features.sort((a, b) => a[1].virtualClock - b[1].virtualClock);

  for (const [slug, data] of features) {
    console.log(`  ${slug.padEnd(21)}${data.virtualClock.toFixed(2).padEnd(13)}${data.weight.toFixed(1).padEnd(8)}${String(data.queued).padEnd(8)}${data.running}`);
  }

  // Find next scheduled
  const nextFeature = features.find(([, data]) => data.queued > 0);
  if (nextFeature) {
    console.log(`\n  NEXT SCHEDULED: ${nextFeature[0]} (lowest virtual clock with pending tasks)`);
    console.log(`  REASON: WFQ fairness — ${nextFeature[0]} has used least proportional time`);
  }

  return 0;
}

/**
 * ogu scheduler:simulate --tasks N — Simulate scheduling N tasks (dry-run).
 */
export async function schedulerSimulate() {
  const args = process.argv.slice(3);
  let taskCount = 10;
  const tasksIdx = args.indexOf('--tasks');
  if (tasksIdx !== -1 && args[tasksIdx + 1]) {
    taskCount = parseInt(args[tasksIdx + 1]) || 10;
  }

  const root = repoRoot();
  const result = simulateScheduling(root, { taskCount });

  console.log(`SCHEDULER SIMULATION (${taskCount} tasks, dry-run):\n`);
  console.log('  ROUND  TASK                FEATURE              CLASS         VT');
  console.log('  ────── ─────────────────── ──────────────────── ──────────── ─────');

  for (const entry of result.scheduledOrder) {
    console.log(`  ${String(entry.round).padEnd(7)}${entry.taskId.padEnd(20)}${entry.featureSlug.padEnd(21)}${entry.priorityClass.padEnd(13)}${entry.virtualClock.toFixed(2)}`);
  }

  console.log('\n  FINAL VIRTUAL CLOCKS:');
  for (const [slug, vt] of Object.entries(result.finalVirtualClocks)) {
    console.log(`    ${slug}: ${vt.toFixed(2)}`);
  }

  return 0;
}
