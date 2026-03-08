# Dataset Split Module Compiler — Implementation Guide

## Purpose
Implement a reproducible, leakage-free dataset split with proper stratification and temporal awareness.

## Required Output Files
- `split-spec.json` — split configuration
- `split.py` — splitting module

## split-spec.json Structure
```json
{
  "task": "classification",
  "train_ratio": 0.7,
  "val_ratio": 0.15,
  "test_ratio": 0.15,
  "split_rationale": "Standard 70/15/15 for classification with enough validation data"
}
```

## split.py Pattern
```python
from sklearn.model_selection import train_test_split
import pandas as pd

RANDOM_STATE = 42

def split(df: pd.DataFrame, target: str) -> tuple:
    # SPLIT FIRST, then fit transformers
    X = df.drop(columns=[target])
    y = df[target]

    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=RANDOM_STATE, stratify=y  # stratify for classification
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=RANDOM_STATE, stratify=y_temp
    )
    return X_train, X_val, X_test, y_train, y_val, y_test
```

## Anti-Patterns
- Fitting a scaler on the full dataset BEFORE splitting (data leakage)
- `train_test_split` without `random_state` (non-reproducible)
- For classification: not using `stratify=y` (unbalanced splits)
- For time-series: not using `TimeSeriesSplit` (future leaks into past)
