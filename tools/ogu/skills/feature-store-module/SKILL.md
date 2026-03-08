---
name: feature-store-module
description: Compiler skill for the feature-store-module compiler. Activates when producing feature-store-artifact.json. Gates: FS001–FS008. Hard-fails when spec missing.
---

# feature-store-module — Compiler Skill

## What This Compiler Does

Compiles feature store integration modules — validates spec structure (feature group, entity key, version), requires feature versioning in both spec and code, requires entity key declaration and reference, detects training-serving skew patterns, requires TTL for online stores, and checks for the upstream `feature-pipeline` artifact.

**Upstream dependency:** `feature-pipeline` (checks `.ogu/artifacts/feature-pipeline-artifact.json`)
**Output artifact:** `feature-store-artifact.json`
**IR identifier:** `FEATURE_STORE:{project}`

---

## Spec Shape

```json
{
  "feature_group": "customer_features",
  "entity_key": "customer_id",
  "version": 3,
  "store_type": "online",
  "ttl_days": 7,
  "features": [
    { "name": "age", "dtype": "float32" },
    { "name": "tenure_months", "dtype": "int32" },
    { "name": "monthly_charges", "dtype": "float32" }
  ]
}
```

Required fields:
- `feature_group` — string
- `features` — array, each with `name` and `dtype`
- `entity_key` — string
- `version` — positive integer

---

## Gates

### FS001 — spec-valid
Reads `feature-store-spec.json`. Hard-fails if missing. Required: `feature_group`, `features` (each with `name` and `dtype`), `entity_key`, `version`.

BAD: spec missing or any feature without `dtype`.
GOOD: all four top-level fields present, all features typed.

### FS002 — feature-versioned
`version` must be a positive integer in spec AND referenced in Python code as `version=N` or `VERSION=N`.

BAD:
```python
fg = FeatureGroup(name="customer_features")  # no version
```
GOOD:
```python
VERSION = 3  # matches spec.version
fg = FeatureGroup(name="customer_features", version=VERSION)
```
Escape: `versioningExternal: true` in spec.

### FS003 — entity-key-declared
`entity_key` from spec must be referenced in Python code. The entity key links features to entities at serving time.

BAD:
```python
fg = FeatureGroup(name="customer_features", version=3)
# entity_key "customer_id" never referenced in code
```
GOOD:
```python
ENTITY_KEY = "customer_id"  # matches spec.entity_key
fg = FeatureGroup(name="customer_features", version=3, primary_key=[ENTITY_KEY])
```
Escape: `entityKeyExternal: true` in spec.

### FS004 — no-training-serving-skew (labeled FS006 in code)
Detects patterns that cause training-serving skew:
- `.fit_transform()` outside a Pipeline
- `pd.get_dummies()` (encoding differs between training and serving)
- `LabelEncoder().fit_transform(...)` — fitted encoder not saved for serving

BAD:
```python
X_train_enc = pd.get_dummies(X_train)   # encoding may differ in serving
label_enc = LabelEncoder()
y_train = label_enc.fit_transform(y_train)  # encoder not saved
```
GOOD:
```python
# Use Pipeline — encoder saved inside pipeline.joblib
pipeline = Pipeline([("enc", OneHotEncoder(handle_unknown="ignore")), ("model", clf)])
pipeline.fit(X_train, y_train)
joblib.dump(pipeline, "artifacts/pipeline.joblib")
```
Escape: `# @skew-ok`.

### FS005 — feature-ttl-defined
For online feature stores (`store_type` other than `"offline"`), TTL must be declared. Accepted: `ttl_days`, `ttl_hours`, `ttl`, `max_age_days` in spec OR `timedelta` / `TTL=` in Python code.

BAD:
```json
{ "store_type": "online", "feature_group": "customer_features" }
// no ttl_days — features never expire
```
GOOD:
```json
{ "store_type": "online", "ttl_days": 7 }
```
Escape: `store_type: "offline"` in spec (skips TTL check for offline stores).

### FS006 — cross-feature-pipeline (labeled FS007 in code)
Checks `.ogu/artifacts/feature-pipeline-artifact.json` exists and has `pass: true`. The upstream feature-pipeline must have passed.

Gate is **skipped** (not failed) if the artifact file is not found.

### FS007 — no-todos (labeled FS007 in code)
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### FS008 — contract-feature-store
Final contract check (RULES array — no escape hatch):
- `entity_key` present in spec
- `version` present in spec
- No f-string SQL patterns (`f"SELECT {col} FROM..."`) — SQL injection risk
- All features in spec have `dtype`

---

## What This Compiler Never Forgives

- `feature-store-spec.json` missing (FS001 hard-fails)
- `feature_group`, `features`, `entity_key`, or `version` missing (FS001)
- Any feature without `dtype` (FS001, FS008)
- `version` not a positive integer (FS001)
- `version` not referenced in Python code (FS002)
- `entity_key` not referenced in Python code (FS003)
- `.fit_transform()` outside Pipeline, `pd.get_dummies()`, or unfitted `LabelEncoder` (FS004)
- Online store without `ttl_days`/`ttl_hours`/`ttl` declaration (FS005)
- Upstream feature-pipeline artifact failed (FS006 — when artifact exists)
- TODO/FIXME/HACK/XXX anywhere (FS007)
- f-string SQL in feature store code (FS008)
