---
name: feature-pipeline
description: Compiler skill for the feature-pipeline compiler. Activates when producing feature-pipeline-artifact.json. Gates: FP001–FP010. Hard-fails when spec missing.
---

# feature-pipeline — Compiler Skill

## What This Compiler Does

Compiles feature engineering pipelines — validates spec structure, requires sklearn `Pipeline` (prevents fit-on-test leakage), blocks fitting on test/validation data, blocks chained assignment, requires random_state on stochastic transformers, detects target leakage (target column in features), requires transformers fit on training data only, requires feature name export, and blocks TODO/FIXME markers.

**Upstream dependency:** none
**Output artifact:** `feature-pipeline-artifact.json`
**IR identifier:** `FEATURE_PIPELINE:{project}`

---

## Spec Shape

```json
{
  "features": ["age", "income", "tenure_months", "category"],
  "target": "churned",
  "transformers": {
    "numeric": ["StandardScaler"],
    "categorical": ["OneHotEncoder"]
  }
}
```

Required fields:
- `features` — non-empty array of feature names
- `target` — string (target column name)
- `transformers` — object (transformer declarations)

---

## Gates

### FP001 — spec-valid
Reads `feature-pipeline-spec.json`. Hard-fails if missing. Required: `features` (non-empty array), `target`, `transformers`.

BAD: spec missing or `features: []` empty.
GOOD: all three fields present.

### FP002 — sklearn-pipeline-used (labeled FP001 in code)
sklearn `Pipeline` must be used. Accepted patterns: `Pipeline(steps=`, `make_pipeline(`, `ColumnTransformer(`, `FeatureUnion(`.

BAD:
```python
scaler = StandardScaler()
encoder = OneHotEncoder()
X_train_scaled = scaler.fit_transform(X_train_num)
X_train_enc = encoder.fit_transform(X_train_cat)
```
GOOD:
```python
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.compose import ColumnTransformer

preprocessor = ColumnTransformer([
    ("num", StandardScaler(), numeric_features),
    ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
])
pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
pipeline.fit(X_train, y_train)
```
Escape: `# @no-pipeline-ok`.

### FP003 — no-fit-on-test (labeled FP002 in code)
Blocks `.fit()` or `.fit_transform()` called on test/validation variables: `X_test`, `x_test`, `X_val`, `x_val`, `val_data`, `test_data`.

BAD:
```python
scaler.fit_transform(X_test)  # leaks test statistics into scaler
```
GOOD:
```python
scaler.fit(X_train)
X_test_scaled = scaler.transform(X_test)
```
Escape: `# @fit-test-ok`.

### FP004 — no-chained-assignment (labeled FP003 in code)
Blocks `df[col1][col2] = value` chained assignment pattern and `pd.options.mode.chained_assignment = None` (which suppresses warnings instead of fixing root cause).

BAD:
```python
df["new_col"] = df["a"]["b"]  # chained — creates copy
pd.options.mode.chained_assignment = None  # silences warning
```
GOOD:
```python
df["new_col"] = df.loc[:, "a"].copy()
df = df.assign(new_col=df["a"])
```
Escape: `# @chained-ok`.

### FP005 — random-state-set (labeled FP004 in code)
Stochastic transformers without `random_state=` are blocked: `IterativeImputer`, `KNNImputer`, `UMAP`, `TSNE`, `KMeans`, `GaussianRandomProjection`, `SparseRandomProjection`.

BAD:
```python
imputer = IterativeImputer()
reducer = TSNE(n_components=2)
```
GOOD:
```python
imputer = IterativeImputer(random_state=42)
reducer = TSNE(n_components=2, random_state=42)
```
Escape: `# @no-random-state-ok`.

### FP006 — no-target-leakage (labeled FP005 in code)
Target column must not appear in the `features` array in spec. Also detects `target_mean`, `target_enc`, `_target` pattern naming, and target name inside `ColumnTransformer`.

BAD:
```json
{ "features": ["age", "churned", "income"], "target": "churned" }
```
GOOD:
```json
{ "features": ["age", "income", "tenure"], "target": "churned" }
```
Escape: `# @target-in-features-ok`.

### FP007 — transformer-fit-on-train (labeled FP006 in code)
Transformer `.fit(df)`, `.fit(data)`, `.fit(X)`, `.fit(features)` calls on the full dataset are blocked. Must be `.fit(X_train)` or inside a Pipeline.

BAD:
```python
scaler = StandardScaler()
scaler.fit(df)  # fits on entire dataset including test
```
GOOD:
```python
scaler.fit(X_train)
# OR use Pipeline which handles this automatically
```
Escape: `# @fit-on-full-ok`.

### FP008 — feature-names-exported (labeled FP008 in code)
Feature names must be exported/saved. Accepted patterns:
- `feature_names_in_` attribute access
- `get_feature_names_out()` call
- `FEATURE_NAMES = [` constant
- `json.dump(.*feature` — saving to JSON
- `metadata[.*feature.*] =` — storing in metadata

BAD: pipeline fit but feature names never saved.
GOOD:
```python
FEATURE_NAMES = pipeline.named_steps["preprocessor"].get_feature_names_out()
with open("artifacts/feature_names.json", "w") as f:
    json.dump(list(FEATURE_NAMES), f)
```
Escape: `featureNamesInArtifact: true` in spec.

### FP009 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### FP010 — contract-feature-pipeline
Final contract check (RULES array — no escape hatch):
- `sklearn.pipeline`/`make_pipeline`/`ColumnTransformer`/`Pipeline(` import present
- No `.ix[` deprecated indexer used
- Type hints on `def` functions (`pd.`/`np.`/`DataFrame`/`ndarray` annotations)

---

## What This Compiler Never Forgives

- `feature-pipeline-spec.json` missing (FP001 hard-fails)
- `features`, `target`, or `transformers` missing (FP001)
- `features: []` empty (FP001)
- No sklearn Pipeline, make_pipeline, or ColumnTransformer (FP002)
- `.fit()` or `.fit_transform()` on test/validation data (FP003)
- Chained assignment `df[a][b] = val` or `chained_assignment = None` (FP004)
- Stochastic transformer without `random_state=` (FP005)
- Target column in features array (FP006)
- Transformer `.fit(df)` on full dataset outside Pipeline (FP007)
- Feature names not exported (FP008)
- TODO/FIXME/HACK/XXX anywhere (FP009)
- No Pipeline import, `.ix[` used, or no type hints on functions (FP010)
