---
name: model-monitoring-config
description: Compiler skill for the model-monitoring-config compiler. Activates when producing monitoring-artifact.json. Gates: MM001–MM008. Hard-fails when spec missing.
---

# model-monitoring-config — Compiler Skill

## What This Compiler Does

Compiles model monitoring configurations — validates spec structure (drift metric, alert threshold, retraining trigger), requires drift metric declarations with test types and thresholds, requires retraining trigger declarations with conditions and actions, requires baseline distribution reference (captured at training time), requires data quality checks separate from drift, requires alert thresholds and actions for all monitored metrics, and blocks TODO/FIXME markers.

**Upstream dependency:** none
**Output artifact:** `monitoring-artifact.json`
**IR identifier:** `MODEL_MONITORING:{project}`

---

## Spec Shape (`monitoring-spec.json`)

```json
{
  "model_name": "churn-predictor-v3",
  "drift_metric": "ks_test",
  "alert_threshold": 0.05,
  "retraining_trigger": "performance_drop"
}
```

Required fields:
- `model_name` — string
- `drift_metric` — string
- `alert_threshold` — number
- `retraining_trigger` — string

---

## Config Shape (`monitoring-config.json`)

```json
{
  "drift_metrics": [
    {
      "name": "feature_drift",
      "features": ["age", "income"],
      "drift_test": "ks_test",
      "threshold": 0.05,
      "alert_action": "slack:#ml-alerts"
    },
    {
      "name": "prediction_drift",
      "drift_test": "psi",
      "threshold": 0.2,
      "alert_action": "pagerduty:ml-oncall"
    }
  ],
  "retraining_triggers": [
    {
      "type": "performance_drop",
      "metric": "f1_score",
      "threshold": 0.05,
      "action": "trigger_pipeline",
      "pipeline": "training_pipeline_v2"
    }
  ],
  "baseline_distribution": {
    "path": "artifacts/training_baseline_stats.parquet",
    "created_at": "2024-01-15",
    "model_version": "v3.0.0",
    "n_samples": 50000
  },
  "data_quality_checks": [
    { "type": "null_rate", "features": ["age", "income"], "max_null_rate": 0.05 },
    { "type": "value_range", "feature": "age", "min": 0, "max": 120 }
  ],
  "default_alert_action": "slack:#ml-alerts"
}
```

---

## Gates

### MM001 — spec-valid
Reads `monitoring-spec.json`. Hard-fails if missing. Required: `model_name`, `drift_metric`, `alert_threshold` (number), `retraining_trigger`. No escape hatch.

BAD: spec missing or `alert_threshold: "high"` (string, not number).
GOOD: all four fields present with numeric threshold.

### MM002 — drift-metric-defined
`monitoring-config.json` must declare `drift_metrics` array. Each entry requires:
- `name` — string
- `drift_test` — one of: `psi`, `ks_test`, `wasserstein`, `js_divergence`, `chi_squared`, `kolmogorov_smirnov`, `evidently`, `custom`
- `threshold` — number

BAD: `drift_metrics` array empty or missing `drift_test` on an entry.
GOOD:
```json
"drift_metrics": [
  { "name": "feature_drift", "drift_test": "ks_test", "threshold": 0.05 },
  { "name": "prediction_drift", "drift_test": "psi", "threshold": 0.2 }
]
```
Escape: `driftMonitoringExternal: true` in config (Arize/WhyLabs/Evidently handles it).

### MM003 — retraining-trigger
`monitoring-config.json` must declare `retraining_triggers` array. Each entry requires:
- `type` — one of: `drift_threshold`, `performance_drop`, `scheduled`, `data_volume`, `manual_approval`, `custom`
- `threshold` — required for `performance_drop`/`drift_threshold`
- `schedule` — required for `scheduled` type (cron expression)
- `action` — required for all non-`manual_approval` types

BAD: `retraining_triggers` missing or empty.
GOOD:
```json
"retraining_triggers": [
  { "type": "performance_drop", "metric": "f1_score", "threshold": 0.05, "action": "trigger_pipeline" },
  { "type": "scheduled", "schedule": "0 0 * * 1", "action": "trigger_pipeline" }
]
```
Escape: `retrainingManual: true` in config (regulatory models requiring human review).

### MM004 — baseline-distribution (labeled MM001 in code)
`monitoring-config.json` must declare `baseline_distribution` object with:
- `path` — string pointing to stored training distribution artifact

BAD: no `baseline_distribution` key — drift has no reference to compare against.
GOOD:
```json
"baseline_distribution": {
  "path": "artifacts/training_baseline.parquet",
  "model_version": "v3.0.0",
  "n_samples": 50000
}
```
Escape: `baselineComputedOnline: true` in config (rolling window baseline).

### MM005 — data-quality-checks (labeled MM005 in code)
`monitoring-config.json` must declare `data_quality_checks` array separate from drift detection. Valid check types: `null_rate`, `value_range`, `completeness`, `schema_match`, `uniqueness`, `referential_integrity`, `custom`, `expectations_suite`.

BAD: no `data_quality_checks` — drift alerts but not silent zero-fill or NULL injection.
GOOD:
```json
"data_quality_checks": [
  { "type": "null_rate", "features": ["age"], "max_null_rate": 0.05 },
  { "type": "value_range", "feature": "age", "min": 0, "max": 120 }
]
```
Escape: `dataQualityExternal: true` in config (feature store or upstream pipeline enforces quality).

### MM006 — alert-threshold-set (labeled MM004 in code)
Every item in `drift_metrics` and `performance_metrics` must have:
- `threshold` — numeric value
- `alert_action` — OR a `default_alert_action` at config top level

BAD: drift metric declared but no `threshold` and no `default_alert_action`.
GOOD:
```json
{
  "default_alert_action": "slack:#ml-alerts",
  "drift_metrics": [
    { "name": "feature_drift", "drift_test": "ks_test", "threshold": 0.05 }
  ]
}
```
Escape: `alertsExternal: true` in config (Datadog/PagerDuty/Grafana configures alerts).

### MM007 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### MM008 — contract-monitoring
Final contract check (RULES array — no escape hatch):
- `monitoring-spec.json` exists
- Drift metric detection code present in Python files: `PSI`, `ks_test`, `ks_2samp`, `DataDrift`, `evidently`, `drift_metric`, or `wasserstein`
- `alert_threshold` in `monitoring-spec.json` is a numeric value

---

## What This Compiler Never Forgives

- `monitoring-spec.json` missing (MM001 hard-fails)
- `model_name`, `drift_metric`, `alert_threshold`, or `retraining_trigger` missing (MM001)
- `alert_threshold` is not a number (MM001, MM008)
- `drift_metrics` array missing or empty (MM002)
- `drift_test` missing or unknown value on any drift metric (MM002)
- `threshold` missing on any drift metric (MM002)
- `retraining_triggers` array missing or empty (MM003)
- Trigger missing `type`, `threshold` (for drift/performance), `schedule` (for scheduled), or `action` (MM003)
- No `baseline_distribution` declared (MM004)
- `baseline_distribution.path` missing (MM004)
- No `data_quality_checks` declared (MM005)
- Any drift/performance metric missing `threshold` or `alert_action` (MM006)
- TODO/FIXME/HACK/XXX anywhere (MM007)
- No drift detection code in Python files (MM008)
