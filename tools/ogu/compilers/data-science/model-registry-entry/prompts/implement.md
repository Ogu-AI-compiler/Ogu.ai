# Model Registry Entry Compiler — Implementation Guide

## Purpose
Register a trained model with full metadata, reproducibility hash, and model card link.

## Required Output Files
- `registry-spec.json` — registry entry configuration
- `model-metadata.json` — training params, metrics, dataset version
- `MODEL_CARD.md` (or link to it)
- Serialized model artifact (`.joblib`, `.pkl`, `.onnx`)

## registry-spec.json Structure
```json
{
  "model_name": "churn_predictor",
  "version": "2.1.0",
  "primary_metric": "f1_macro",
  "performance_threshold": 0.75,
  "model_card_path": "MODEL_CARD.md"
}
```

## model-metadata.json Pattern
```json
{
  "model_name": "churn_predictor",
  "version": "2.1.0",
  "training_run_id": "mlflow-run-abc123",
  "git_commit": "a1b2c3d",
  "dataset_version": "user_events_v3",
  "params": { "n_estimators": 200, "max_depth": 10, "random_state": 42 },
  "metrics": { "f1_macro": 0.82, "accuracy": 0.89, "roc_auc": 0.91 }
}
```

## Anti-Patterns
- Model artifact without metadata (untraceble)
- No performance threshold check before registration
- Missing model card link
- No git commit or run ID (reproducibility lost)
