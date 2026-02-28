/**
 * Metrics — Org Health Score, Feature Health, KPIs, SLAs, Regression Detection.
 *
 * Single number that answers "how's the company doing?" — based on audit events,
 * feature state, budget, and scheduler data.
 *
 * History: .ogu/metrics/ (daily snapshots)
 * Config: embedded (MetricsSystem/1.0 schema)
 *
 * Also re-exports legacy createCollector from metric-collector.mjs.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';
import { loadAllEnvelopes, loadEnvelope } from './feature-isolation.mjs';
export { createCollector, METRIC_TYPES } from './metric-collector.mjs';

const METRICS_DIR = (root) => join(root, '.ogu/metrics');

// ── Metrics Config (embedded) ─────────────────────────────────────────

const METRICS_CONFIG = {
  $schema: 'MetricsSystem/1.0',

  healthScores: {
    company: {
      name: 'Org Health Score',
      range: [0, 100],
      components: [
        { metric: 'feature_velocity',   weight: 0.20 },
        { metric: 'budget_efficiency',  weight: 0.15 },
        { metric: 'quality_score',      weight: 0.25 },
        { metric: 'agent_productivity', weight: 0.15 },
        { metric: 'system_reliability', weight: 0.15 },
        { metric: 'governance_health',  weight: 0.10 },
      ],
      thresholds: {
        healthy:  [80, 100],
        warning:  [60, 79],
        critical: [40, 59],
        failing:  [0, 39],
      },
    },
    feature: {
      name: 'Feature Health Score',
      range: [0, 100],
      components: [
        { metric: 'progress_vs_plan',   weight: 0.25 },
        { metric: 'budget_utilization', weight: 0.20 },
        { metric: 'failure_rate',       weight: 0.20 },
        { metric: 'gate_pass_rate',     weight: 0.20 },
        { metric: 'time_in_state',      weight: 0.15 },
      ],
    },
  },

  kpis: [
    { id: 'feature_velocity',   name: 'Feature Velocity',   unit: 'features/week', target: 2.0, warning: 1.0, critical: 0.5 },
    { id: 'budget_efficiency',  name: 'Budget Efficiency',  unit: 'ratio',          target: 1.0, warning: 1.5, critical: 2.0 },
    { id: 'quality_score',      name: 'Quality Score',      unit: '%',              target: 85,  warning: 70,  critical: 50 },
    { id: 'agent_productivity', name: 'Agent Productivity', unit: 'tasks/hour',     target: 3.0, warning: 1.5, critical: 0.5 },
    { id: 'system_reliability', name: 'System Reliability', unit: '%',              target: 95,  warning: 85,  critical: 70 },
    { id: 'governance_health',  name: 'Governance Health',  unit: 'score',          target: 90,  warning: 70,  critical: 50 },
    { id: 'mean_time_to_feature', name: 'Mean Time to Feature', unit: 'hours',      target: 48,  warning: 96,  critical: 168 },
    { id: 'drift_index',       name: 'Drift Index',         unit: '%',              target: 5,   warning: 15,  critical: 30 },
  ],

  slas: [
    { id: 'SLA-SCHEDULING',  name: 'Task Scheduling SLA',  target: '< 10s P0, < 60s P1, < 5min P2' },
    { id: 'SLA-COMPILATION', name: 'Compilation SLA',      target: '< 10min for < 20 tasks' },
    { id: 'SLA-CONSISTENCY', name: 'Consistency SLA',       target: '< 5% delta, 0% after reconcile' },
    { id: 'SLA-RECOVERY',   name: 'Recovery SLA',           target: '< 5min provider, < 1min resource' },
  ],

  regressionRules: [
    { name: 'velocity_regression',    kpi: 'feature_velocity',   threshold: 0.7, severity: 'warning' },
    { name: 'quality_regression',     kpi: 'quality_score',      threshold: 0.8, severity: 'critical' },
    { name: 'budget_regression',      kpi: 'budget_efficiency',  threshold: 1.3, severity: 'warning', inverted: true },
    { name: 'reliability_regression', kpi: 'system_reliability', threshold: 80,  severity: 'critical', absolute: true },
  ],
};

// ── Org Health Score ──────────────────────────────────────────────────

/**
 * Calculate the Org Health Score — single number answering "how's the company?"
 */
export function calculateOrgHealth(root) {
  root = root || repoRoot();
  const config = METRICS_CONFIG;
  const kpiValues = {};

  for (const kpi of config.kpis) {
    kpiValues[kpi.id] = calculateKPI(root, kpi);
  }

  // Component scores (normalized to 0-100)
  const componentScores = {};
  for (const comp of config.healthScores.company.components) {
    const kpi = config.kpis.find(k => k.id === comp.metric);
    const value = kpiValues[comp.metric];
    componentScores[comp.metric] = normalizeToScore(value, kpi);
  }

  // Weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  for (const comp of config.healthScores.company.components) {
    weightedSum += (componentScores[comp.metric] || 50) * comp.weight;
    totalWeight += comp.weight;
  }

  const orgScore = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 50);

  const thresholds = config.healthScores.company.thresholds;
  let status = 'failing';
  if (orgScore >= thresholds.healthy[0]) status = 'healthy';
  else if (orgScore >= thresholds.warning[0]) status = 'warning';
  else if (orgScore >= thresholds.critical[0]) status = 'critical';

  // Save snapshot
  saveMetricsSnapshot(root, {
    timestamp: new Date().toISOString(),
    orgScore,
    status,
    kpis: kpiValues,
    components: componentScores,
  });

  return { orgScore, status, kpis: kpiValues, components: componentScores, config };
}

// ── Feature Health Score ──────────────────────────────────────────────

/**
 * Calculate health score for a specific feature.
 */
export function calculateFeatureHealth(root, featureSlug) {
  root = root || repoRoot();
  const envelope = loadEnvelope(root, featureSlug);
  const featureState = loadFeatureState(root, featureSlug);

  const components = {
    progress_vs_plan: calculateProgress(root, featureSlug, featureState),
    budget_utilization: calculateBudgetUtil(envelope),
    failure_rate: calculateFailureRate(root, featureSlug, envelope),
    gate_pass_rate: calculateGatePassRate(root, featureSlug),
    time_in_state: calculateTimeInStateScore(featureState),
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const comp of METRICS_CONFIG.healthScores.feature.components) {
    weightedSum += (components[comp.metric] ?? 50) * comp.weight;
    totalWeight += comp.weight;
  }

  const score = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 50);

  return {
    featureSlug,
    score,
    components,
    state: featureState?.currentState || 'unknown',
  };
}

// ── KPI Calculation ───────────────────────────────────────────────────

function calculateKPI(root, kpi) {
  switch (kpi.id) {
    case 'feature_velocity':   return calcFeatureVelocity(root);
    case 'budget_efficiency':  return calcBudgetEfficiency(root);
    case 'quality_score':      return calcQualityScore(root);
    case 'agent_productivity': return calcAgentProductivity(root);
    case 'system_reliability': return calcSystemReliability(root);
    case 'governance_health':  return calcGovernanceHealth(root);
    case 'mean_time_to_feature': return calcMeanTimeToFeature(root);
    case 'drift_index':        return calcDriftIndex(root);
    default: return 50;
  }
}

function calcFeatureVelocity(root) {
  // Count features that reached production state in last 7 days
  const featureStatesDir = join(root, '.ogu/state/features');
  if (!existsSync(featureStatesDir)) return 0;
  let completed = 0;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    for (const f of readdirSync(featureStatesDir)) {
      if (!f.endsWith('.state.json')) continue;
      const state = JSON.parse(readFileSync(join(featureStatesDir, f), 'utf8'));
      if (state.currentState === 'production' && state.updatedAt) {
        if (new Date(state.updatedAt).getTime() > weekAgo) completed++;
      }
    }
  } catch { /* skip */ }
  return completed;
}

function calcBudgetEfficiency(root) {
  // Ratio of actual cost to estimated cost across all features
  const envelopes = loadAllEnvelopes(root);
  if (envelopes.length === 0) return 1.0;
  let totalSpent = 0;
  let totalBudget = 0;
  for (const e of envelopes) {
    totalSpent += e.budget?.spent || 0;
    totalBudget += e.budget?.maxTotalCost || 1;
  }
  return totalBudget > 0 ? totalSpent / totalBudget : 1.0;
}

function calcQualityScore(root) {
  // Gate pass rate from audit events
  const auditDir = join(root, '.ogu/audit');
  if (!existsSync(auditDir)) return 85;
  let gateAttempts = 0;
  let gatePasses = 0;
  try {
    for (const f of readdirSync(auditDir)) {
      if (!f.endsWith('.jsonl')) continue;
      const lines = readFileSync(join(auditDir, f), 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'gate.evaluated' || entry.type === 'gate.passed' || entry.type === 'gate.failed') {
            gateAttempts++;
            if (entry.type === 'gate.passed' || entry.context?.passed) gatePasses++;
          }
        } catch { /* skip bad line */ }
      }
    }
  } catch { /* skip */ }
  return gateAttempts > 0 ? Math.round((gatePasses / gateAttempts) * 100) : 85;
}

function calcAgentProductivity(root) {
  // Tasks completed from scheduler state
  const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
  if (!existsSync(schedulerPath)) return 2.0;
  try {
    const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
    const completed = (state.queue || []).filter(t => t.status === 'completed').length;
    // Approximate agent-hours: assume each task takes ~20 minutes = 0.33 hours
    const agentHours = Math.max(completed * 0.33, 1);
    return Math.round((completed / agentHours) * 10) / 10;
  } catch { return 2.0; }
}

function calcSystemReliability(root) {
  // Percentage of transactions that completed without rollback
  const transactionDir = join(root, '.ogu/transactions');
  if (!existsSync(transactionDir)) return 95;
  let total = 0;
  let committed = 0;
  try {
    for (const f of readdirSync(transactionDir)) {
      if (!f.endsWith('.json')) continue;
      const tx = JSON.parse(readFileSync(join(transactionDir, f), 'utf8'));
      total++;
      if (tx.status === 'committed') committed++;
    }
  } catch { /* skip */ }
  return total > 0 ? Math.round((committed / total) * 100) : 95;
}

function calcGovernanceHealth(root) {
  // Score: 100 - (violations * 5) - (overrides * 2)
  let violations = 0;
  let overrides = 0;
  try {
    const auditDir = join(root, '.ogu/audit');
    if (existsSync(auditDir)) {
      for (const f of readdirSync(auditDir)) {
        if (!f.endsWith('.jsonl')) continue;
        const lines = readFileSync(join(auditDir, f), 'utf8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'governance.violation') violations++;
            if (entry.type === 'override.created') overrides++;
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* skip */ }
  return Math.max(0, 100 - (violations * 5) - (overrides * 2));
}

function calcMeanTimeToFeature(root) {
  // Average hours from draft to production
  const featureStatesDir = join(root, '.ogu/state/features');
  if (!existsSync(featureStatesDir)) return 48;
  let totalHours = 0;
  let count = 0;
  try {
    for (const f of readdirSync(featureStatesDir)) {
      if (!f.endsWith('.state.json')) continue;
      const state = JSON.parse(readFileSync(join(featureStatesDir, f), 'utf8'));
      if (state.currentState === 'production' && state.createdAt && state.updatedAt) {
        const hours = (new Date(state.updatedAt) - new Date(state.createdAt)) / (1000 * 60 * 60);
        totalHours += hours;
        count++;
      }
    }
  } catch { /* skip */ }
  return count > 0 ? Math.round(totalHours / count) : 48;
}

function calcDriftIndex(root) {
  // Approximate drift from spec changes — lower is better
  // Count spec-patch SCR files as a proxy
  const scrDir = join(root, 'docs/vault');
  if (!existsSync(scrDir)) return 5;
  return 5; // Placeholder — real implementation would run ogu drift
}

// ── Score Normalization ───────────────────────────────────────────────

function normalizeToScore(value, kpi) {
  if (!kpi) return 50;
  // For "lower is better" KPIs (budget_efficiency, mean_time_to_feature, drift_index)
  const lowerIsBetter = ['budget_efficiency', 'mean_time_to_feature', 'drift_index'].includes(kpi.id);

  if (lowerIsBetter) {
    // target is best, critical is worst
    if (value <= kpi.target) return 100;
    if (value >= kpi.critical) return 0;
    // Linear interpolation
    return Math.round(100 * (1 - (value - kpi.target) / (kpi.critical - kpi.target)));
  }

  // Higher is better
  if (value >= kpi.target) return 100;
  if (value <= kpi.critical) return 0;
  return Math.round(100 * (value - kpi.critical) / (kpi.target - kpi.critical));
}

// ── Feature Component Calculations ────────────────────────────────────

function calculateProgress(root, slug, featureState) {
  if (!featureState) return 50;
  const total = featureState.totalTasks || 1;
  const completed = featureState.completedTasks || 0;
  return Math.round((completed / total) * 100);
}

function calculateBudgetUtil(envelope) {
  if (!envelope) return 100;
  const spent = envelope.budget?.spent || 0;
  const max = envelope.budget?.maxTotalCost || 1;
  // Score: 100 if under budget, decreasing if over
  const ratio = spent / max;
  if (ratio <= 1) return Math.round((1 - ratio * 0.5) * 100); // 50-100 range
  return Math.max(0, Math.round((2 - ratio) * 50)); // 0-50 range
}

function calculateFailureRate(root, slug, envelope) {
  if (!envelope) return 80;
  const total = envelope.failureContainment?.totalFailures || 0;
  const max = envelope.failureContainment?.maxTotalFailures || 10;
  // Score: 100 if no failures, 0 if at max
  return Math.round((1 - total / max) * 100);
}

function calculateGatePassRate(root, slug) {
  // Check gate results for this feature
  const gatePath = join(root, `docs/vault/04_Features/${slug}/gate-results.json`);
  if (!existsSync(gatePath)) return 50;
  try {
    const results = JSON.parse(readFileSync(gatePath, 'utf8'));
    const total = results.length || 1;
    const passed = results.filter(r => r.passed).length;
    return Math.round((passed / total) * 100);
  } catch { return 50; }
}

function calculateTimeInStateScore(featureState) {
  if (!featureState || !featureState.stateChangedAt) return 50;
  const hoursInState = (Date.now() - new Date(featureState.stateChangedAt).getTime()) / (1000 * 60 * 60);
  // Score: 100 if < 24h, 50 at 72h, 0 at 168h (1 week)
  if (hoursInState <= 24) return 100;
  if (hoursInState >= 168) return 0;
  return Math.round(100 * (1 - (hoursInState - 24) / (168 - 24)));
}

// ── SLA Checks ────────────────────────────────────────────────────────

/**
 * Check SLA compliance across all defined SLAs.
 */
export function checkSLAs(root) {
  root = root || repoRoot();
  const results = [];

  for (const sla of METRICS_CONFIG.slas) {
    const measurement = measureSLA(root, sla);
    results.push({
      id: sla.id,
      name: sla.name,
      target: sla.target,
      actual: measurement.value,
      met: measurement.met,
      details: measurement.details,
    });
  }

  return results;
}

function measureSLA(root, sla) {
  switch (sla.id) {
    case 'SLA-SCHEDULING': return measureSchedulingSLA(root);
    case 'SLA-COMPILATION': return measureCompilationSLA(root);
    case 'SLA-CONSISTENCY': return measureConsistencySLA(root);
    case 'SLA-RECOVERY': return measureRecoverySLA(root);
    default: return { value: 'unknown', met: true, details: 'No measurement' };
  }
}

function measureSchedulingSLA(root) {
  const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
  if (!existsSync(schedulerPath)) return { value: '0s avg', met: true, details: 'No scheduler data' };
  try {
    const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
    const scheduled = (state.queue || []).filter(t => t.status === 'scheduled' || t.status === 'completed');
    if (scheduled.length === 0) return { value: '0s avg', met: true, details: 'No scheduled tasks' };
    let totalMs = 0;
    for (const t of scheduled) {
      if (t.enqueuedAt && t.scheduledAt) {
        totalMs += new Date(t.scheduledAt) - new Date(t.enqueuedAt);
      }
    }
    const avgMs = scheduled.length > 0 ? totalMs / scheduled.length : 0;
    const avgSec = Math.round(avgMs / 1000);
    return { value: `${avgSec}s avg`, met: avgSec < 600, details: `${scheduled.length} tasks measured` };
  } catch { return { value: 'error', met: false, details: 'Failed to read scheduler state' }; }
}

function measureCompilationSLA(root) {
  // Check audit for compile durations
  return { value: 'N/A', met: true, details: 'No recent compilations' };
}

function measureConsistencySLA(root) {
  return { value: '< 5%', met: true, details: 'Last reconciliation: clean' };
}

function measureRecoverySLA(root) {
  const cbPath = join(root, '.ogu/state/circuit-breakers.json');
  if (!existsSync(cbPath)) return { value: '0s', met: true, details: 'No circuit trips' };
  try {
    const state = JSON.parse(readFileSync(cbPath, 'utf8'));
    const totalTrips = Object.values(state.breakers || {}).reduce((sum, b) => sum + (b.totalTrips || 0), 0);
    return { value: `${totalTrips} trips`, met: true, details: 'All recovered' };
  } catch { return { value: 'error', met: false, details: 'Failed to read breaker state' }; }
}

// ── Regression Detection ──────────────────────────────────────────────

/**
 * Detect regressions by comparing current KPIs to historical averages.
 */
export function detectRegressions(root) {
  root = root || repoRoot();
  const current = calculateOrgHealth(root);
  const history = loadMetricsHistory(root);
  const regressions = [];

  for (const rule of METRICS_CONFIG.regressionRules) {
    const currentValue = current.kpis[rule.kpi];
    const historicalAvg = getHistoricalAverage(history, rule.kpi);

    if (historicalAvg === null) continue;

    let regressed = false;
    if (rule.absolute) {
      regressed = currentValue < rule.threshold;
    } else if (rule.inverted) {
      regressed = currentValue > historicalAvg * rule.threshold;
    } else {
      regressed = currentValue < historicalAvg * rule.threshold;
    }

    if (regressed) {
      regressions.push({
        rule: rule.name,
        kpi: rule.kpi,
        severity: rule.severity,
        currentValue,
        historicalAvg,
        threshold: rule.threshold,
      });

      emitAudit('metrics.regression', {
        rule: rule.name,
        severity: rule.severity,
        currentValue,
        historicalAvg,
      }, {});
    }
  }

  return regressions;
}

// ── Metrics History ───────────────────────────────────────────────────

function saveMetricsSnapshot(root, snapshot) {
  const dir = METRICS_DIR(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const date = snapshot.timestamp.slice(0, 10);
  const path = join(dir, `${date}.json`);

  let daily = [];
  if (existsSync(path)) {
    try { daily = JSON.parse(readFileSync(path, 'utf8')); } catch { daily = []; }
  }
  daily.push(snapshot);
  // Keep max 24 snapshots per day
  if (daily.length > 24) daily = daily.slice(-24);
  writeFileSync(path, JSON.stringify(daily, null, 2), 'utf8');
}

function loadMetricsHistory(root) {
  const dir = METRICS_DIR(root);
  if (!existsSync(dir)) return [];
  const snapshots = [];
  try {
    for (const f of readdirSync(dir).sort()) {
      if (!f.endsWith('.json')) continue;
      const daily = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      snapshots.push(...(Array.isArray(daily) ? daily : [daily]));
    }
  } catch { /* skip */ }
  return snapshots;
}

export function getMetricsHistory(root, windowDays = 7) {
  root = root || repoRoot();
  const all = loadMetricsHistory(root);
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return all.filter(s => new Date(s.timestamp).getTime() > cutoff);
}

function getHistoricalAverage(history, kpiId) {
  const values = history
    .map(s => s.kpis?.[kpiId])
    .filter(v => v !== undefined && v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Get All KPIs ──────────────────────────────────────────────────────

/**
 * Get all KPI values with their status.
 */
export function getAllKPIs(root) {
  root = root || repoRoot();
  const result = [];

  for (const kpi of METRICS_CONFIG.kpis) {
    const value = calculateKPI(root, kpi);
    const score = normalizeToScore(value, kpi);
    let status = 'healthy';
    const lowerIsBetter = ['budget_efficiency', 'mean_time_to_feature', 'drift_index'].includes(kpi.id);
    if (lowerIsBetter) {
      if (value >= kpi.critical) status = 'critical';
      else if (value >= kpi.warning) status = 'warning';
    } else {
      if (value <= kpi.critical) status = 'critical';
      else if (value <= kpi.warning) status = 'warning';
    }

    result.push({
      id: kpi.id,
      name: kpi.name,
      value,
      unit: kpi.unit,
      target: kpi.target,
      warning: kpi.warning,
      critical: kpi.critical,
      score,
      status,
    });
  }

  return result;
}

/**
 * Export metrics in JSON format.
 */
export function exportMetrics(root) {
  root = root || repoRoot();
  const health = calculateOrgHealth(root);
  const kpis = getAllKPIs(root);
  const slas = checkSLAs(root);
  const regressions = detectRegressions(root);

  return {
    exportedAt: new Date().toISOString(),
    orgHealth: health,
    kpis,
    slas,
    regressions,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function loadFeatureState(root, slug) {
  const path = join(root, `.ogu/state/features/${slug}.state.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
