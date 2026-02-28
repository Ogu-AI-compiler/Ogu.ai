# Performance Index Contract

> Formal contract for the agent performance tracking and learning loop.

## Version

1.0

## Purpose

Track per-agent, per-model, per-capability performance metrics. Detect learning signals for automated routing improvements. The system must learn from its own execution history.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/performance/index.json` | Aggregated performance metrics |
| `.ogu/performance/history/YYYY-MM.jsonl` | Monthly performance log |

## Performance Index Schema

| Section | Contents |
|---------|----------|
| `byRole` | Per-role: totalTasks, successRate, avgCostPerTask, escalationRate, byCapability, domainStrength |
| `byModel` | Per-model: totalCalls, successRate, avgCost, avgLatencyMs, byCapability |
| `byFeature` | Per-feature: totalCost, totalTasks, successRate, escalations |
| `learningSignals` | Detected optimization opportunities |

## Learning Signal Types

| Signal | Description | Auto-applicable |
|--------|-------------|-----------------|
| `model_capability_mismatch` | Model fails capability >30% of the time | No |
| `role_domain_weakness` | Role struggles in specific domain | No |
| `high_escalation_rate` | Role escalates >20% of tasks | No |
| `cost_efficiency_opportunity` | Cheaper model succeeds >90% | Yes |

## CLI Commands

| Command | Purpose |
|---------|---------|
| `performance:index` | Show performance report |

## Invariants

1. Performance Index updates after every task completion.
2. Learning signals require minimum sample size before generating.
3. Auto-applicable signals can be applied without human approval.
4. Non-auto-applicable signals require human approval.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3101 | Signal not found |
| OGU3102 | Signal requires human approval |

## Implementation

| Component | Path |
|-----------|------|
| Performance index | `tools/ogu/commands/lib/performance-index.mjs` |
| Performance CLI | `tools/ogu/commands/performance-cmd.mjs` |
