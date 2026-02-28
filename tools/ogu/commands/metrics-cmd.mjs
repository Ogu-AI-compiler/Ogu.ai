/**
 * Metrics CLI Commands.
 *
 * Commands:
 *   metrics:health [slug]  — Org or Feature Health Score
 *   metrics:kpis           — All KPIs with current values
 *   metrics:sla            — SLA compliance dashboard
 *   metrics:regression     — Check for regressions
 *   metrics:export         — Export metrics as JSON
 */

import { repoRoot } from '../util.mjs';
import { calculateOrgHealth, calculateFeatureHealth, getAllKPIs, checkSLAs, detectRegressions, exportMetrics, getMetricsHistory } from './lib/metrics.mjs';

export async function metricsHealth() {
  const root = repoRoot();
  const slug = process.argv[3];

  if (slug && !slug.startsWith('-')) {
    return featureHealthDisplay(root, slug);
  }

  const health = calculateOrgHealth(root);

  const statusIcon = {
    healthy: 'HEALTHY',
    warning: 'WARNING',
    critical: 'CRITICAL',
    failing: 'FAILING',
  };

  console.log(`ORG HEALTH SCORE: ${health.orgScore}/100 (${statusIcon[health.status] || health.status})`);
  console.log('');

  console.log('  COMPONENT             SCORE    WEIGHT   KPI VALUE          TARGET');
  console.log('  ──────────────────── ──────── ──────── ────────────────── ──────────');

  const componentNames = {
    feature_velocity: 'Feature Velocity',
    budget_efficiency: 'Budget Efficiency',
    quality_score: 'Quality Score',
    agent_productivity: 'Agent Productivity',
    system_reliability: 'System Reliability',
    governance_health: 'Governance Health',
  };

  const kpiUnits = {
    feature_velocity: 'feat/week',
    budget_efficiency: 'ratio',
    quality_score: '%',
    agent_productivity: 'tasks/hr',
    system_reliability: '%',
    governance_health: 'score',
  };

  for (const comp of health.config.healthScores.company.components) {
    const name = (componentNames[comp.metric] || comp.metric).padEnd(22);
    const score = String(Math.round(health.components[comp.metric] || 0)).padEnd(8);
    const weight = `${Math.round(comp.weight * 100)}%`.padEnd(8);
    const value = health.kpis[comp.metric] ?? '—';
    const unit = kpiUnits[comp.metric] || '';
    const kpiDef = health.config.kpis.find(k => k.id === comp.metric);
    const target = kpiDef ? kpiDef.target : '—';
    const valueStr = `${value} ${unit}`.padEnd(18);
    const targetStr = `${target}`;
    console.log(`  ${name} ${score} ${weight} ${valueStr} ${targetStr}`);
  }

  // SLA summary
  const slas = checkSLAs(root);
  if (slas.length > 0) {
    console.log('');
    console.log('  SLA COMPLIANCE:');
    for (const sla of slas) {
      const met = sla.met ? 'met' : 'BREACH';
      console.log(`    ${sla.id.padEnd(18)} ${met.padEnd(8)} (${sla.actual})`);
    }
  }

  // Regressions
  const regressions = detectRegressions(root);
  if (regressions.length > 0) {
    console.log('');
    console.log('  REGRESSIONS:');
    for (const r of regressions) {
      const severity = r.severity === 'critical' ? '!!' : '!';
      console.log(`    ${severity} ${r.rule}: current=${r.currentValue}, avg=${r.historicalAvg?.toFixed(1)}`);
    }
  }

  return 0;
}

function featureHealthDisplay(root, slug) {
  const health = calculateFeatureHealth(root, slug);

  console.log(`FEATURE HEALTH: ${slug} — ${health.score}/100`);
  console.log(`  State: ${health.state}`);
  console.log('');
  console.log('  COMPONENT             SCORE    DETAILS');
  console.log('  ──────────────────── ──────── ──────────────────────────');

  const names = {
    progress_vs_plan: 'Progress vs Plan',
    budget_utilization: 'Budget Utilization',
    failure_rate: 'Failure Rate',
    gate_pass_rate: 'Gate Pass Rate',
    time_in_state: 'Time in State',
  };

  for (const [key, value] of Object.entries(health.components)) {
    const name = (names[key] || key).padEnd(22);
    const score = `${Math.round(value ?? 0)}%`.padEnd(8);
    console.log(`  ${name} ${score}`);
  }

  return 0;
}

export async function metricsKpis() {
  const root = repoRoot();
  const kpis = getAllKPIs(root);

  console.log('KPI DASHBOARD:');
  console.log('');
  console.log('  KPI                    VALUE           UNIT           TARGET   STATUS');
  console.log('  ────────────────────── ─────────────── ────────────── ──────── ──────────');

  for (const kpi of kpis) {
    const name = kpi.name.padEnd(22);
    const value = String(kpi.value).padEnd(15);
    const unit = kpi.unit.padEnd(14);
    const target = String(kpi.target).padEnd(8);
    const status = kpi.status.toUpperCase();
    console.log(`  ${name} ${value} ${unit} ${target} ${status}`);
  }

  return 0;
}

export async function metricsSla() {
  const root = repoRoot();
  const slas = checkSLAs(root);

  console.log('SLA COMPLIANCE:');
  console.log('');
  console.log('  SLA                  TARGET                              ACTUAL       MET');
  console.log('  ──────────────────── ─────────────────────────────────── ──────────── ─────');

  for (const sla of slas) {
    const name = sla.name.padEnd(22);
    const target = sla.target.padEnd(35);
    const actual = sla.actual.padEnd(12);
    const met = sla.met ? 'YES' : 'NO';
    console.log(`  ${name} ${target} ${actual} ${met}`);
  }

  return 0;
}

export async function metricsRegression() {
  const root = repoRoot();
  const regressions = detectRegressions(root);

  console.log('REGRESSION DETECTION:');
  console.log('');

  if (regressions.length === 0) {
    console.log('  No regressions detected.');
    return 0;
  }

  console.log('  RULE                       SEVERITY   CURRENT    AVG        THRESHOLD');
  console.log('  ────────────────────────── ────────── ────────── ────────── ──────────');

  for (const r of regressions) {
    const rule = r.rule.padEnd(26);
    const severity = r.severity.toUpperCase().padEnd(10);
    const current = String(r.currentValue).padEnd(10);
    const avg = r.historicalAvg !== null ? r.historicalAvg.toFixed(1).padEnd(10) : '—'.padEnd(10);
    const threshold = String(r.threshold).padEnd(10);
    console.log(`  ${rule} ${severity} ${current} ${avg} ${threshold}`);
  }

  return 0;
}

export async function metricsExport() {
  const root = repoRoot();
  const format = process.argv.find((a, i) => process.argv[i - 1] === '--format') || 'json';

  const data = exportMetrics(root);

  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('METRICS EXPORT:');
    console.log(`  Org Health: ${data.orgHealth.orgScore}/100 (${data.orgHealth.status})`);
    console.log(`  KPIs: ${data.kpis.length} measured`);
    console.log(`  SLAs: ${data.slas.filter(s => s.met).length}/${data.slas.length} met`);
    console.log(`  Regressions: ${data.regressions.length} detected`);
  }

  return 0;
}
