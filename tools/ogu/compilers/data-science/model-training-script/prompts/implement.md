# Model Training Script Compiler — Implementation Guide

## Purpose
Build a reproducible, tracked, and serializable model training script with configurable hyperparameters.

## Required Output Files
- `training-spec.json` — training configuration reference
- `train.py` — training script
- `config.yaml` — hyperparameters

## training-spec.json Structure
```json
{
  "model_type": "RandomForestClassifier",
  "task": "classification",
  "config_file": "config.yaml",
  "metrics": ["accuracy", "f1", "roc_auc"]
}
```

## train.py Pattern
```python
import random
import numpy as np
import mlflow
import joblib
import yaml
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

def train(X_train, y_train) -> Pipeline:
    with open("config.yaml") as f:
        config = yaml.safe_load(f)

    with mlflow.start_run():
        mlflow.log_params(config["hyperparameters"])
        model = Pipeline([
            ("clf", RandomForestClassifier(**config["hyperparameters"], random_state=SEED))
        ])
        model.fit(X_train, y_train)
        mlflow.log_metric("train_accuracy", model.score(X_train, y_train))
        joblib.dump(model, Path("models/model.joblib"))
    return model

if __name__ == "__main__":
    from split import split
    from load import load_data
    X_train, X_val, X_test, y_train, y_val, y_test = split(load_data(), "target")
    train(X_train, y_train)
```

## Anti-Patterns
- Hardcoded `n_estimators=100` instead of loading from config
- No random seed set
- No experiment tracking (mlflow/wandb)
- No model serialization
- `.fit(X_test)` during training
