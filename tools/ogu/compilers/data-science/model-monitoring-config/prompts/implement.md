# Model Monitoring Config Compiler — Implementation Guide

## Purpose
Configure production model monitoring with drift detection, alerting thresholds, and retraining triggers.

## Required Output Files
- `monitoring-spec.json` — monitoring configuration
- `monitor.py` or Evidently config

## monitoring-spec.json Structure
```json
{
  "model_name": "churn_predictor",
  "drift_metric": "PSI",
  "alert_threshold": 0.2,
  "retraining_trigger": {
    "metric": "f1_macro",
    "threshold": 0.70,
    "window_days": 7
  },
  "data_quality_checks": ["missing_rate", "schema_drift"]
}
```

## monitor.py Pattern (Evidently)
```python
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset
import pandas as pd

reference_data = pd.read_parquet("baseline/reference_data.parquet")

def run_drift_check(current_data: pd.DataFrame) -> dict:
    report = Report(metrics=[DataDriftPreset()])
    report.run(reference_data=reference_data, current_data=current_data)
    result = report.as_dict()
    drift_score = result["metrics"][0]["result"]["dataset_drift"]
    return {"drift_detected": drift_score, "threshold": 0.2}
```

## Anti-Patterns
- No baseline distribution for comparison
- Alert threshold not defined (monitoring fires on everything or nothing)
- No retraining trigger — drift detected but never acted upon
- No data quality checks (missing values, schema changes)
