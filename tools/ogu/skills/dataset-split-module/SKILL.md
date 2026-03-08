---
name: dataset-split-module
description: Compiler skill for the dataset-split-module compiler. Activates when producing split-artifact.json. Gates: SP001–SP009. Hard-fails when spec missing.
---

# dataset-split-module — Compiler Skill

## What This Compiler Does

Compiles dataset splitting code — validates spec structure and ratio sums, requires reproducible splits (random seeds), detects transformer fitting before the split (data leakage), detects test contamination during fit_transform, requires stratification for classification tasks, requires temporal-aware splitting for time-series tasks, and validates that code split ratios match spec.

**Upstream dependency:** none
**Output artifact:** `split-artifact.json`
**IR identifier:** `DATASET_SPLIT:{project}`

---

## Spec Shape

```json
{
  "task": "classification",
  "train_ratio": 0.7,
  "val_ratio": 0.1,
  "test_ratio": 0.2,
  "stratify": true,
  "random_seed": 42
}
```

Required fields:
- `task` — string (classification/regression/time_series/etc.)
- `train_ratio` — number
- `test_ratio` — number
- All ratios must sum to 1.0 ±0.01

---

## Gates

### SP001 — spec-valid
Reads `split-spec.json`. Hard-fails if missing. Required: `task`, `train_ratio`, `test_ratio`. Ratios must sum to 1.0 ±0.01.

BAD: `train_ratio: 0.8, test_ratio: 0.3` — sums to 1.1.
GOOD: `train_ratio: 0.7, val_ratio: 0.1, test_ratio: 0.2` — sums to 1.0.

### SP002 — reproducible-split
Split must use a fixed random seed. Accepted patterns: `train_test_split(random_state=N)`, `KFold(random_state=N)`, `np.random.seed(N)`, `random.seed(N)`.

BAD:
```python
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
```
GOOD:
```python
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
```
Escape: `# @no-seed-ok`.

### SP003 — split-before-transform (labeled SP002 in code)
`.fit()` or `.fit_transform()` called BEFORE `train_test_split` on the same line order = leakage. Safe: Pipeline/pipe/clf.fit() calls are not flagged.

BAD:
```python
scaler.fit_transform(X)              # fits on full dataset
X_train, X_test = train_test_split(X_scaled, test_size=0.2)
```
GOOD:
```python
X_train, X_test = train_test_split(X, test_size=0.2, random_state=42)
scaler.fit(X_train)                  # fits only on train
X_test_scaled = scaler.transform(X_test)
```
Escape: `# @split-order-ok`.

### SP004 — no-test-contamination (labeled SP003 in code)
Blocks `scaler/encoder/imputer/transformer.fit_transform(X)` on the full dataset before the split. Transformers must be fit only on training data.

BAD:
```python
X_scaled = StandardScaler().fit_transform(X)  # uses full dataset
X_train, X_test = train_test_split(X_scaled)
```
GOOD:
```python
X_train, X_test = train_test_split(X, random_state=42)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)
```
Escape: `# @test-use-ok`.

### SP005 — stratified-if-classification (labeled SP005 in code)
For `task: classification`, `binary_classification`, or `multiclass`, split must use `stratify=y` or `StratifiedKFold`. Gate auto-passes for `regression`, `time_series`, `forecasting`, `unsupervised`.

BAD:
```python
# task: classification
X_train, X_test = train_test_split(X, y, test_size=0.2)  # no stratify
```
GOOD:
```python
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
```
Escape: `# @no-stratify-ok`.

### SP006 — temporal-aware-split (labeled SP006 in code)
For `task: time_series`, `forecasting`, or `temporal`, split must use `TimeSeriesSplit` or chronological sort + index. Random shuffle splits are a violation for temporal data.

BAD:
```python
# task: time_series
X_train, X_test = train_test_split(X, y, random_state=42)  # random shuffle leaks future
```
GOOD:
```python
from sklearn.model_selection import TimeSeriesSplit
tscv = TimeSeriesSplit(n_splits=5)
for train_idx, test_idx in tscv.split(X):
    X_train, X_test = X[train_idx], X[test_idx]
```
Escape: `# @random-split-ok`.

### SP007 — split-ratios-documented (labeled SP007 in code)
`train_ratio` + `test_ratio` must be in spec AND the `test_size` parameter in code must match `spec.test_ratio`.

BAD: `test_size=0.3` in code but `test_ratio: 0.2` in spec.
GOOD: `test_size=0.2` matches `test_ratio: 0.2`.
Escape: `ratioJustified: true` or `use_cross_validation: true` in spec.

### SP008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### SP009 — contract-split
Final contract check (RULES array — no escape hatch):
- `random_state=` appears in split code
- No `.fit/.fit_transform(X_test/x_test)` calls

---

## What This Compiler Never Forgives

- `split-spec.json` missing (SP001 hard-fails)
- `task`, `train_ratio`, or `test_ratio` missing (SP001)
- Ratios that don't sum to 1.0 ±0.01 (SP001)
- `train_test_split` without `random_state=` (SP002)
- Transformer `.fit()` before `train_test_split` in code order (SP003)
- `fit_transform(X)` on full dataset before split (SP004)
- Classification task without `stratify=y` or `StratifiedKFold` (SP005)
- Time series task with random shuffle split (SP006)
- `test_size` in code doesn't match `test_ratio` in spec (SP007)
- TODO/FIXME/HACK/XXX anywhere (SP008)
- No `random_state=` or `.fit(X_test)` calls present (SP009)
