/**
 * Consistency Reconciler Loop.
 *
 * Runs every 30s to detect and fix state drift:
 * - Orphaned tasks: dispatched but runner process is gone
 * - Stale dispatches: dispatched > 10 min ago with no runner active
 * - Feature state drift: features stuck in "building" with no pending tasks
 * - Scheduler queue bloat: completed tasks older than 1 hour get archived
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

export function createConsistencyLoop({ root, intervalMs, runnerPool, emitAudit }) {
  let timer = null;
  let running = true;
  let lastTick = null;
  let tickCount = 0;
  let lastReport = null;

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    const issues = [];

    // 1. Orphaned tasks: dispatched but not in runner pool
    const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerPath)) {
      const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
      const now = Date.now();

      for (const task of state.queue) {
        if (task.status === 'dispatched') {
          const isActive = runnerPool.active.has(task.taskId);
          const dispatchedAge = now - new Date(task.dispatchedAt || task.enqueuedAt).getTime();

          // If dispatched but no runner and older than 2 minutes → orphaned
          if (!isActive && dispatchedAge > 120000) {
            task.status = 'pending';
            task.orphanedAt = new Date().toISOString();
            task.orphanCount = (task.orphanCount || 0) + 1;
            issues.push({ type: 'orphaned_task', taskId: task.taskId, age: dispatchedAge });
          }

          // If dispatched and older than 10 minutes → stale (even with runner)
          if (dispatchedAge > 600000) {
            issues.push({ type: 'stale_dispatch', taskId: task.taskId, age: dispatchedAge, hasRunner: isActive });
          }
        }

        // Archive completed tasks older than 1 hour
        if (task.status === 'completed' && task.completedAt) {
          const completedAge = now - new Date(task.completedAt).getTime();
          if (completedAge > 3600000) {
            task._archived = true;
          }
        }
      }

      // Remove archived tasks from queue
      const archived = state.queue.filter(t => t._archived);
      if (archived.length > 0) {
        state.queue = state.queue.filter(t => !t._archived);
        issues.push({ type: 'archived_completed', count: archived.length });

        // Write to archive file
        const archivePath = join(root, '.ogu/state/scheduler-archive.jsonl');
        for (const t of archived) {
          delete t._archived;
          appendFileSync(archivePath, JSON.stringify(t) + '\n', 'utf8');
        }
      }

      if (issues.length > 0) {
        state.updatedAt = new Date().toISOString();
        writeFileSync(schedulerPath, JSON.stringify(state, null, 2), 'utf8');
      }
    }

    // 2. Feature state drift: building features with no pending/dispatched tasks
    const featuresDir = join(root, '.ogu/state/features');
    if (existsSync(featuresDir)) {
      for (const file of readdirSync(featuresDir)) {
        if (!file.endsWith('.state.json')) continue;
        try {
          const featurePath = join(featuresDir, file);
          const feature = JSON.parse(readFileSync(featurePath, 'utf8'));
          if (feature.currentState === 'building' && feature.tasks) {
            const hasPendingOrDispatched = feature.tasks.some(
              t => t.status === 'pending' || t.status === 'dispatched'
            );
            const allCompleted = feature.tasks.every(t => t.status === 'completed');

            if (!hasPendingOrDispatched && !allCompleted && feature.tasks.length > 0) {
              // Some tasks failed/cancelled but no pending work — flag it
              issues.push({
                type: 'stuck_feature',
                slug: feature.slug,
                tasks: feature.tasks.map(t => ({ taskId: t.taskId, status: t.status })),
              });
            }
          }
        } catch { /* skip corrupt files */ }
      }
    }

    lastReport = { issues, timestamp: lastTick };

    if (issues.length > 0) {
      emitAudit('consistency.issues_found', {
        count: issues.length,
        issues: issues.map(i => ({ type: i.type, ...(i.taskId ? { taskId: i.taskId } : {}), ...(i.slug ? { slug: i.slug } : {}) })),
      });
    }
  };

  timer = setInterval(async () => {
    if (!running) return;
    try { await tick(); }
    catch (err) { emitAudit('consistency.loop_error', { error: err.message }); }
  }, intervalMs);

  return {
    name: 'consistency',
    get isRunning() { return running; },
    get lastTick() { return lastTick; },
    get tickCount() { return tickCount; },
    get lastReport() { return lastReport; },
    stop() { running = false; clearInterval(timer); },
    forceTick: tick,
  };
}
