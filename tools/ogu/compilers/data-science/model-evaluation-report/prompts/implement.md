# Model Evaluation Report Compiler — Implementation Guide

## Purpose
Build a complete evaluation report that goes beyond accuracy — includes baseline, multiple metrics, and CIs.

## Required Output Files
- `evaluation-spec.json` — evaluation configuration
- `evaluate.py` or `evaluation_report.ipynb`

## evaluation-spec.json Structure
```json
{
  "task": "classification",
  "primary_metric": "f1_macro",
  "baseline_strategy": "majority_class"
}
```

## evaluate.py Pattern
```python
from sklearn.dummy import DummyClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import cross_val_score
import numpy as np

def evaluate(model, X_test, y_test):
    # Baseline
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_test, y_test)
    baseline_acc = dummy.score(X_test, y_test)

    # Primary metrics
    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    # Confidence interval (bootstrap)
    scores = cross_val_score(model, X_test, y_test, cv=5, scoring="f1_macro")
    ci = (scores.mean() - 2*scores.std(), scores.mean() + 2*scores.std())

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
```

## Anti-Patterns
- `model.predict(X_train)` for evaluation (optimistic bias)
- Only reporting accuracy (misleading for imbalanced data)
- No baseline comparison (is the model better than random?)
- No confidence interval (how stable are metrics?)
