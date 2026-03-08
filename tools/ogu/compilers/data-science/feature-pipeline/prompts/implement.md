# Feature Pipeline Compiler — Implementation Guide

## Purpose
Build a sklearn-based feature engineering pipeline that prevents data leakage and is reproducible.

## Required Output Files
- `feature-pipeline-spec.json` — pipeline configuration
- `features.py` — feature pipeline implementation

## feature-pipeline-spec.json Structure
```json
{
  "features": ["age", "income", "days_since_last_purchase"],
  "target": "churned",
  "transformers": ["StandardScaler", "OneHotEncoder"]
}
```

## features.py Pattern
```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.model_selection import train_test_split
import pandas as pd

NUMERIC_FEATURES = ["age", "income", "days_since_last_purchase"]
CATEGORICAL_FEATURES = ["plan_type", "region"]
FEATURE_NAMES = NUMERIC_FEATURES + CATEGORICAL_FEATURES  # exported

def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_FEATURES),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
    ])
    return Pipeline([("preprocessor", preprocessor)])

def get_feature_names_out(pipeline: Pipeline) -> list[str]:
    return pipeline.named_steps["preprocessor"].get_feature_names_out().tolist()
```

## Anti-Patterns
- `.fit_transform()` outside of Pipeline (leaks test distribution into training)
- `.fit(X_test)` or `.fit(df)` without X_train
- `df['col']['row'] = val` chained assignment
- `.ix[]` deprecated indexer
- Target column included in feature transformers
