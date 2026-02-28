/**
 * Metrics Aggregator Loop.
 *
 * Runs every 60s to compute and snapshot system health:
 * - Org health score (from tools/ogu/commands/lib/metrics.mjs)
 * - Scheduler throughput (tasks completed per interval)
 * - Runner utilization (active/total)
 * - Budget burn rate
 *
 * Writes: .ogu/state/metrics-snapshot.json (latest)
 *         .ogu/state/metrics-history.jsonl (append)
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function createMetricsAggregatorLoop({ root, intervalMs, runnerPool, emitAudit }) {
  let timer = null;
  let running = true;
  let lastTick = null;
  let tickCount = 0;
  let lastSnapshot = null;
  let previousCompleted = null; // Track throughput

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    const snapshot = {
      timestamp: lastTick,
      scheduler: { total: 0, pending: 0, dispatched: 0, completed: 0, throughput: 0 },
      runners: { maxConcurrent: 0, active: 0, utilization: 0 },
      budget: { dailySpent: 0, dailyLimit: 100, burnRate: 0 },
      health: { score: 0, status: 'unknown' },
    };

    // Scheduler stats
    const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerPath)) {
      try {
        const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
        const completed = state.queue.filter(t => t.status === 'completed').length;
        snapshot.scheduler = {
          total: state.queue.length,
          pending: state.queue.filter(t => t.status === 'pending').length,
          dispatched: state.queue.filter(t => t.status === 'dispatched').length,
          completed,
          throughput: previousCompleted !== null ? completed - previousCompleted : 0,
        };
        previousCompleted = completed;
      } catch { /* skip */ }
    }

    // Runner utilization
    const runnerStatus = runnerPool.status();
    snapshot.runners = {
      maxConcurrent: runnerStatus.maxConcurrent,
      active: runnerStatus.active,
      utilization: runnerStatus.maxConcurrent > 0
        ? Math.round((runnerStatus.active / runnerStatus.maxConcurrent) * 100)
        : 0,
    };

    // Budget burn rate
    const today = new Date().toISOString().slice(0, 10);
    const budgetPath = join(root, '.ogu/budget/budget-state.json');
    if (existsSync(budgetPath)) {
      try {
        const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
        const dailySpent = budget.daily?.[today]?.spent || 0;
        let dailyLimit = 100;
        const orgSpecPath = join(root, '.ogu/org-spec.json');
        if (existsSync(orgSpecPath)) {
          const org = JSON.parse(readFileSync(orgSpecPath, 'utf8'));
          if (org.budget?.daily?.limit) dailyLimit = org.budget.daily.limit;
        }
        snapshot.budget = {
          dailySpent,
          dailyLimit,
          burnRate: dailyLimit > 0 ? Math.round((dailySpent / dailyLimit) * 100) : 0,
        };
      } catch { /* skip */ }
    }

    // Org health score (try to import from metrics lib)
    try {
      const { calculateOrgHealth } = await import('../../ogu/commands/lib/metrics.mjs');
      const health = calculateOrgHealth(root);
      const score = health.orgScore ?? health.score ?? 0;
      snapshot.health = {
        score,
        status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'critical',
      };
    } catch {
      // Fallback: simple health based on scheduler state
      const pending = snapshot.scheduler.pending;
      const dispatched = snapshot.scheduler.dispatched;
      const score = Math.max(0, 100 - (pending * 2) - (dispatched * 5));
      snapshot.health = { score, status: score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'critical' };
    }

    // Write latest snapshot
    const stateDir = join(root, '.ogu/state');
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'metrics-snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');

    // Append to history (one line per tick)
    appendFileSync(join(stateDir, 'metrics-history.jsonl'), JSON.stringify(snapshot) + '\n', 'utf8');

    lastSnapshot = snapshot;

    // Alert on critical health
    if (snapshot.health.status === 'critical') {
      emitAudit('metrics.health_critical', { score: snapshot.health.score, snapshot });
    }
  };

  timer = setInterval(async () => {
    if (!running) return;
    try { await tick(); }
    catch (err) { emitAudit('metrics.loop_error', { error: err.message }); }
  }, intervalMs);

  return {
    name: 'metrics-aggregator',
    get isRunning() { return running; },
    get lastTick() { return lastTick; },
    get tickCount() { return tickCount; },
    get lastSnapshot() { return lastSnapshot; },
    stop() { running = false; clearInterval(timer); },
    forceTick: tick,
  };
}
