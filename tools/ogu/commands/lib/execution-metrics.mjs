/**
 * execution-metrics.mjs — Slice 426
 * Collects, aggregates, and surfaces execution metrics for marketplace projects.
 *
 * Per-task metrics recorded during runProject:
 *   taskId, ownerRole, ownerAgentId, success, status, durationMs, cost, tokensUsed, gateResult
 *
 * Aggregates (computed on demand):
 *   total tasks, success rate, total cost USD, total tokens, avg duration,
 *   gate pass rate, agent task distribution
 *
 * Storage: .ogu/projects/{projectId}/metrics.json
 *
 * Exports:
 *   recordTaskMetric(root, projectId, metric) → void
 *   aggregateMetrics(root, projectId) → AggregateMetrics | null
 *   saveMetrics(root, projectId, data) → void
 *   loadMetrics(root, projectId) → MetricsData | null
 *   formatMetricsReport(metrics) → string
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './runtime-paths.mjs';

// ── Storage ───────────────────────────────────────────────────────────────────

function metricsFilePath(root, projectId) {
  return join(getProjectsDir(root), projectId, 'metrics.json');
}

function metricsHistoryPath(root, projectId) {
  return join(getProjectsDir(root), projectId, 'metrics-history.jsonl');
}

function normalizeMetrics(data) {
  if (!data) return { tasks: {}, aggregates: null, lastRun: null, lifetime: null };

  const normalized = { ...data };

  if (!normalized.lastRun && normalized.tasks) {
    normalized.lastRun = {
      runId: normalized.runId || 'legacy',
      startedAt: normalized.startedAt || null,
      completedAt: normalized.completedAt || null,
      tasks: normalized.tasks || {},
      aggregates: normalized.aggregates || null,
    };
  }

  if (!normalized.lifetime) {
    normalized.lifetime = {
      runs: 0,
      aggregates: null,
      updatedAt: null,
    };
  }

  if (normalized.lastRun) {
    normalized.tasks = normalized.lastRun.tasks || normalized.tasks || {};
    normalized.aggregates = normalized.lastRun.aggregates || normalized.aggregates || null;
  }

  return normalized;
}

function appendMetricHistory(root, projectId, entry) {
  const dir = join(getProjectsDir(root), projectId);
  mkdirSync(dir, { recursive: true });
  appendFileSync(metricsHistoryPath(root, projectId), JSON.stringify(entry) + '\n', 'utf-8');
}

function loadMetricHistory(root, projectId) {
  const path = metricsHistoryPath(root, projectId);
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function computeAggregates(projectId, tasks) {
  if (!tasks || tasks.length === 0) return null;

  const completed = tasks.filter(t => t.success);
  const failed = tasks.filter(t => !t.success);

  const totalCost = tasks.reduce((s, t) => s + (t.cost || 0), 0);
  const totalTokens = tasks.reduce((s, t) => {
    const tokens = t.tokensUsed;
    if (!tokens) return s;
    if (typeof tokens === 'number') return s + tokens;
    return s + (tokens.input || 0) + (tokens.output || 0) + (tokens.total || 0);
  }, 0);

  const durations = tasks.map(t => t.durationMs || 0);
  const totalDurationMs = durations.reduce((s, d) => s + d, 0);
  const avgDurationMs = tasks.length > 0 ? Math.round(totalDurationMs / tasks.length) : 0;

  const withGateResult = tasks.filter(t => t.gateResult !== undefined);
  const gatePassed = withGateResult.filter(t => t.gateResult === true).length;
  const gatePassRate = withGateResult.length > 0
    ? gatePassed / withGateResult.length
    : null;

  const agentTaskCounts = {};
  for (const t of tasks) {
    const key = t.ownerAgentId || t.ownerRole || 'unassigned';
    agentTaskCounts[key] = (agentTaskCounts[key] || 0) + 1;
  }

  const agentCosts = {};
  for (const t of tasks) {
    const key = t.ownerAgentId || t.ownerRole || 'unassigned';
    agentCosts[key] = (agentCosts[key] || 0) + (t.cost || 0);
  }

  return {
    projectId,
    total: tasks.length,
    completed: completed.length,
    failed: failed.length,
    successRate: completed.length / tasks.length,
    totalCostUSD: Math.round(totalCost * 100000) / 100000,
    totalTokens,
    avgDurationMs,
    totalDurationMs,
    gatePassRate,
    agentTaskCounts,
    agentCosts,
    computedAt: new Date().toISOString(),
  };
}

/**
 * saveMetrics(root, projectId, data) → void
 */
export function saveMetrics(root, projectId, data) {
  const dir = join(getProjectsDir(root), projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(metricsFilePath(root, projectId), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * loadMetrics(root, projectId) → MetricsData | null
 */
export function loadMetrics(root, projectId) {
  const path = metricsFilePath(root, projectId);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

// ── Task metric recording ─────────────────────────────────────────────────────

/**
 * recordTaskMetric(root, projectId, metric) → void
 * Merges a single task metric into the project metrics file.
 *
 * metric: {
 *   taskId, ownerRole?, ownerAgentId?, success, status,
 *   durationMs?, cost?, tokensUsed?, gateResult?
 * }
 */
export function recordTaskMetric(root, projectId, metric) {
  if (!metric?.taskId) return;

  const existing = normalizeMetrics(loadMetrics(root, projectId));
  const runId = metric.runId || existing.lastRun?.runId || `run-${Date.now()}`;
  const runStartedAt = metric.runStartedAt || existing.lastRun?.startedAt || new Date().toISOString();

  if (!existing.lastRun || existing.lastRun.runId !== runId) {
    existing.lastRun = {
      runId,
      startedAt: runStartedAt,
      completedAt: null,
      tasks: {},
      aggregates: null,
    };
  }

  existing.lastRun.tasks[metric.taskId] = {
    ...metric,
    runId,
    runStartedAt,
    recordedAt: new Date().toISOString(),
  };

  existing.tasks = existing.lastRun.tasks;
  existing.aggregates = existing.lastRun.aggregates;

  appendMetricHistory(root, projectId, existing.lastRun.tasks[metric.taskId]);
  saveMetrics(root, projectId, existing);
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * aggregateMetrics(root, projectId) → AggregateMetrics | null
 * Computes aggregate stats from all recorded task metrics.
 */
export function aggregateMetrics(root, projectId) {
  const data = normalizeMetrics(loadMetrics(root, projectId));
  if (!data?.tasks && !data?.lastRun?.tasks) return null;

  const lastRunTasks = Object.values(data.lastRun?.tasks || data.tasks || {});
  if (lastRunTasks.length === 0) return null;

  const lastRunAgg = computeAggregates(projectId, lastRunTasks);
  if (data.lastRun) {
    data.lastRun.aggregates = lastRunAgg;
    data.lastRun.completedAt = new Date().toISOString();
  }
  data.aggregates = lastRunAgg;
  data.tasks = data.lastRun?.tasks || data.tasks || {};

  const history = loadMetricHistory(root, projectId);
  if (history.length > 0) {
    // Use latest entry per runId+taskId
    const latestByKey = new Map();
    for (const entry of history) {
      const runId = entry.runId || 'unknown';
      const taskId = entry.taskId || 'unknown';
      const key = `${runId}:${taskId}`;
      const prev = latestByKey.get(key);
      if (!prev || new Date(entry.recordedAt || 0).getTime() >= new Date(prev.recordedAt || 0).getTime()) {
        latestByKey.set(key, entry);
      }
    }
    const uniqueTasks = Array.from(latestByKey.values());
    const lifetimeAgg = computeAggregates(projectId, uniqueTasks);
    const runIds = new Set(history.map(h => h.runId || 'unknown'));
    data.lifetime = {
      runs: runIds.size,
      aggregates: lifetimeAgg,
      updatedAt: new Date().toISOString(),
    };
  }

  saveMetrics(root, projectId, data);
  return lastRunAgg;
}

// ── Report formatter ──────────────────────────────────────────────────────────

/**
 * formatMetricsReport(metrics) → string
 * Human-readable one-page summary.
 */
export function formatMetricsReport(metrics) {
  if (!metrics) return 'No metrics available.';

  const agg = metrics.lastRun?.aggregates || metrics.aggregates || metrics;

  const successPct = Math.round((agg.successRate || 0) * 100);
  const lines = [
    `── Project Metrics: ${agg.projectId} ──`,
    `Tasks:     ${agg.completed}/${agg.total} completed (${successPct}% success rate)`,
    `Cost:      $${(agg.totalCostUSD || 0).toFixed(5)} USD`,
    `Tokens:    ${(agg.totalTokens || 0).toLocaleString()}`,
    `Duration:  avg ${agg.avgDurationMs || 0}ms · total ${agg.totalDurationMs || 0}ms`,
  ];

  if (agg.gatePassRate !== null && agg.gatePassRate !== undefined) {
    lines.push(`Gates:     ${Math.round((agg.gatePassRate || 0) * 100)}% pass rate`);
  }

  if (agg.agentTaskCounts && Object.keys(agg.agentTaskCounts).length > 0) {
    const dist = Object.entries(agg.agentTaskCounts)
      .map(([a, n]) => `${a}(${n})`)
      .join(', ');
    lines.push(`Agents:    ${dist}`);
  }

  if (metrics.lifetime?.aggregates) {
    const lt = metrics.lifetime.aggregates;
    const runs = metrics.lifetime.runs || 0;
    lines.push(`Lifetime:  ${runs} run(s), ${lt.completed}/${lt.total} completed (${Math.round((lt.successRate || 0) * 100)}%)`);
  }

  lines.push(`Computed:  ${agg.computedAt || 'n/a'}`);
  return lines.join('\n');
}
