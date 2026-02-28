# Metrics Contract

> Formal contract for Org Health Score, Feature Health, KPIs, SLAs, and Regression Detection.

## Version

1.0

## Purpose

Single number that answers "how's the company?" — based on audit events, feature state, budget, and scheduler data. Org Health Score is a weighted average of 6 KPIs. Regressions are detected via sliding window comparison.

## Org Health Score

Weighted average of 6 component scores, normalized to 0-100.

| Component | Weight | KPI Source |
|-----------|--------|------------|
| Feature Velocity | 20% | features completed per week |
| Budget Efficiency | 15% | actual/estimated cost ratio |
| Quality Score | 25% | gate pass rate on first attempt |
| Agent Productivity | 15% | tasks completed per agent-hour |
| System Reliability | 15% | transactions committed without rollback |
| Governance Health | 10% | 100 - violations*5 - overrides*2 |

## Thresholds

| Status | Range |
|--------|-------|
| Healthy | 80-100 |
| Warning | 60-79 |
| Critical | 40-59 |
| Failing | 0-39 |

## KPIs

| ID | Name | Unit | Target | Warning | Critical |
|----|------|------|--------|---------|----------|
| feature_velocity | Feature Velocity | features/week | 2.0 | 1.0 | 0.5 |
| budget_efficiency | Budget Efficiency | ratio | 1.0 | 1.5 | 2.0 |
| quality_score | Quality Score | % | 85 | 70 | 50 |
| agent_productivity | Agent Productivity | tasks/hour | 3.0 | 1.5 | 0.5 |
| system_reliability | System Reliability | % | 95 | 85 | 70 |
| governance_health | Governance Health | score | 90 | 70 | 50 |
| mean_time_to_feature | Mean Time to Feature | hours | 48 | 96 | 168 |
| drift_index | Drift Index | % | 5 | 15 | 30 |

## SLAs

| ID | Name | Target |
|----|------|--------|
| SLA-SCHEDULING | Task Scheduling | < 10s P0, < 60s P1, < 5min P2 |
| SLA-COMPILATION | Compilation | < 10min for < 20 tasks |
| SLA-CONSISTENCY | Consistency | < 5% delta, 0% after reconcile |
| SLA-RECOVERY | Recovery | < 5min provider, < 1min resource |

## Regression Detection

Sliding window comparison between short-term (24h) and long-term (30d) KPI averages.

| Rule | KPI | Condition | Severity |
|------|-----|-----------|----------|
| velocity_regression | feature_velocity | short < long * 0.7 | warning |
| quality_regression | quality_score | short < long * 0.8 | critical |
| budget_regression | budget_efficiency | short > long * 1.3 | warning |
| reliability_regression | system_reliability | short < 80 | critical |

## CLI Commands

| Command | Description |
|---------|-------------|
| `ogu metrics:health` | Org Health Score dashboard |
| `ogu metrics:health <slug>` | Feature Health Score |
| `ogu metrics:kpis` | All KPIs with values |
| `ogu metrics:sla` | SLA compliance dashboard |
| `ogu metrics:regression` | Check for regressions |
| `ogu metrics:export --format json` | Export metrics |

## Invariants

1. Org Health Score = weighted average of normalized component scores.
2. All KPIs sourced from audit events and state files (never computed externally).
3. Regressions detected automatically and audited.
4. SLA breaches escalated via audit events.
5. Metrics history preserved for 30 days minimum.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU7101 | KPI calculation failed |
| OGU7102 | SLA breach detected |
| OGU7103 | Regression detected |
| OGU7104 | Metrics history corrupted |

## State Files

| File | Purpose |
|------|---------|
| `.ogu/metrics/YYYY-MM-DD.json` | Daily metric snapshots |

## Implementation

| Component | Path |
|-----------|------|
| Metrics library | `tools/ogu/commands/lib/metrics.mjs` |
| Metric collector (legacy) | `tools/ogu/commands/lib/metric-collector.mjs` |
| CLI commands | `tools/ogu/commands/metrics-cmd.mjs` |
