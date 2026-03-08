---
name: model-evaluation-report
description: Compiler skill for the model-evaluation-report compiler. Activates when producing evaluation-artifact.json. Gates: ME001–ME010. Hard-fails when spec missing.
---

# model-evaluation-report — Compiler Skill

## What This Compiler Does

Compiles model evaluation reports — validates spec structure (pre-registered primary metric and baseline strategy), requires metrics computed on test set only, blocks evaluation data leakage, requires baseline comparison, requires multiple complementary metrics, requires confusion matrix (classification) or residuals analysis (regression), requires confidence intervals, and requires findings with next-step recommendations.

**Upstream dependency:** none
**Output artifact:** `evaluation-artifact.json`
**IR identifier:** `MODEL_EVALUATION:{project}`

---

## Spec Shape

```json
{
  "task": "classification",
  "primary_metric": "f1_score",
  "baseline_strategy": "majority_class",
  "baseline_metric": "f1_score",
  "baseline_value": 0.71
}
```

Required fields:
- `task` — string (classification/regression/etc.)
- `primary_metric` — string
- `baseline_strategy` — string

---

## Gates

### ME001 — spec-valid
Reads `evaluation-spec.json`. Hard-fails if missing. Required: `task`, `primary_metric`, `baseline_strategy`. No escape hatch — all production evaluations need a spec.

BAD: spec missing or any required field absent.
GOOD: all three fields present.

### ME002 — test-set-only (labeled ME001 in code)
Final model metrics must be computed on the test set, not training or validation sets. Blocked patterns: `accuracy_score(y_train,...)`, `f1_score(y_val,...)`, `classification_report(y_valid,...)`.

BAD:
```python
# Reports training accuracy as final metric — reports memorization not generalization
print(f"F1: {f1_score(y_train, y_pred_train):.4f}")
```
GOOD:
```python
y_pred = model.predict(X_test)
print(f"Test F1: {f1_score(y_test, y_pred):.4f}")
```
Escape: `# @train-eval-ok: <reason>` (e.g., for learning curve plots showing both train and test metrics).

### ME003 — no-eval-leakage (labeled ME002 in code)
Evaluation code must not use test set statistics to transform test features. Blocked:
- `fit_transform(X_test/x_test/test_*)` — re-fitting transformer on test data
- `X_test.mean()`, `X_test.std()` — computing test-set statistics
- `fillna(X_test.mean())` — using test mean to impute

BAD:
```python
X_test_scaled = scaler.fit_transform(X_test)  # leaks test statistics
```
GOOD:
```python
scaler = StandardScaler().fit(X_train)
X_test_scaled = scaler.transform(X_test)  # applies train statistics to test
```
Escape: `# @eval-transform-ok: <reason>`.

### ME004 — baseline-comparison (labeled ME003 in code)
Evaluation must compare against a declared baseline. Accepted patterns:
- `DummyClassifier(` / `DummyRegressor(` — sklearn baseline
- `baseline` / `majority_class` / `previous_model` mentions in code
- `baseline_metric` + `baseline_value` in `eval-spec.json`

BAD: only model metrics, no baseline to compare against.
GOOD:
```python
from sklearn.dummy import DummyClassifier
baseline = DummyClassifier(strategy="most_frequent").fit(X_train, y_train)
baseline_f1 = f1_score(y_test, baseline.predict(X_test))
model_f1   = f1_score(y_test, model.predict(X_test))
print(f"Improvement: +{model_f1 - baseline_f1:.4f}")
```
Escape: `baselineInSpec: true` in spec with `baseline_metric` + `baseline_value`.

### ME005 — multiple-metrics (labeled ME004 in code)
At least 2 complementary metrics must be computed.

Classification needs ≥2 of: F1, precision, recall, ROC-AUC, average precision, MCC.
Regression needs ≥2 of: RMSE/MSE, MAE, R², MAPE.

BAD:
```python
print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")  # only one metric
```
GOOD:
```python
from sklearn.metrics import classification_report
print(classification_report(y_test, y_pred))  # prints F1, precision, recall
```
Escape: `# @single-metric-ok: <reason>`.

### ME006 — confusion-matrix-or-residuals (labeled ME005 in code)
Classification: must include confusion matrix (`confusion_matrix(`, `ConfusionMatrixDisplay`, `plot_confusion_matrix`).
Regression: must include residuals analysis (`residuals`, `y_pred - y_test`, `plot_residuals`).

Task is detected from `eval-spec.json` `task` field OR inferred from code imports.

BAD (classification):
```python
print(f"F1: {f1_score(y_test, y_pred):.4f}")  # no confusion matrix
```
GOOD (classification):
```python
from sklearn.metrics import ConfusionMatrixDisplay
ConfusionMatrixDisplay.from_predictions(y_test, y_pred)
plt.savefig("confusion_matrix.png")
```
GOOD (regression):
```python
residuals = y_test - y_pred
plt.scatter(y_pred, residuals)
plt.axhline(0, color="red", linestyle="--")
```
Escape: `skipConfusionMatrix: true` or `skipResidualsPlot: true` in `eval-spec.json`.

### ME007 — confidence-intervals (labeled ME007 in code)
Metric uncertainty must be quantified. Accepted patterns:
- `cross_val_score` — K-fold std as confidence estimate
- `scipy.stats.*.interval` — parametric CI
- `bootstrap` / `resample.*\d{3,}` — bootstrap resampling
- `confidence_interval` / `conf_int`
- `wilson.*interval` / `proportion.*confint`

BAD: only point estimates with no uncertainty bound.
GOOD:
```python
scores = cross_val_score(model, X, y, cv=5, scoring="f1_macro")
print(f"F1: {scores.mean():.3f} ± {scores.std() * 2:.3f}")
# OR bootstrap:
idx = np.random.choice(len(y_test), (1000, len(y_test)))
ci = np.percentile([f1_score(y_test[i], y_pred[i]) for i in idx], [2.5, 97.5])
```
Escape: `# @no-ci-ok: <reason>`.

### ME008 — findings-documented (labeled ME008 in code)
Evaluation report must include:
1. A findings/conclusions/results section with interpretation
2. Next steps or recommendations

BAD: table of metrics with no interpretation.
GOOD:
```markdown
## Findings
The model achieves F1=0.87 on the test set, exceeding the 0.85 deployment threshold.
- False negative rate on fraud class: 8% — acceptable for this use case
- Model underperforms on new customers (tenure < 30 days) due to sparse history

## Recommendations
- Deploy with automated monitoring on class 2 recall
- Next iteration: add tenure-based features for new customer segments
```
Escape: `findingsInDocs: true` in spec.

### ME009 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb`, `.md` files.

### ME010 — contract-evaluation
Final contract check (RULES array — no escape hatch):
- Multiple metrics: ≥2 classification metrics (f1_score + precision_score/recall_score) OR ≥2 regression metrics (mean_squared_error + mean_absolute_error/r2_score)
- Baseline present: `DummyClassifier`/`DummyRegressor` or `baseline_metric`/`baseline_score`
- Test set predictions: `predict(X_test/x_test/test_X/test_features)` present

---

## What This Compiler Never Forgives

- `evaluation-spec.json` missing (ME001 hard-fails)
- `task`, `primary_metric`, or `baseline_strategy` missing (ME001)
- Metrics computed on `y_train` or `y_val` as final metrics (ME002)
- `fit_transform(X_test)` or `X_test.mean()` used to transform test data (ME003)
- No baseline comparison (ME004)
- Fewer than 2 complementary metrics (ME005)
- Classification without confusion matrix or regression without residuals (ME006)
- No confidence intervals or uncertainty quantification (ME007)
- No findings section or no next steps/recommendations (ME008)
- TODO/FIXME/HACK/XXX anywhere (ME009)
- Contract violations: no multiple metrics, no baseline, no test-set predictions (ME010)
