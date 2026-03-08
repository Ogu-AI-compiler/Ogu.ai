---
name: experiment-config
description: Compiler skill for the experiment-config compiler. Activates when producing experiment-config-artifact.json. Gates: EC001–EC008. Hard-fails when spec missing.
---

# experiment-config — Compiler Skill

## What This Compiler Does

Compiles ML experiment configuration — validates spec structure, requires an external YAML/JSON config file, requires hyperparameter documentation (inline comments in YAML, `_doc` keys in JSON), requires reproducibility seeds and framework version tracking, blocks hardcoded hyperparameters when no config loader is present, and validates HPO search space declarations.

**Upstream dependency:** none
**Output artifact:** `experiment-config-artifact.json`
**IR identifier:** `EXPERIMENT_CONFIG:{project}`

---

## Spec Shape

```json
{
  "experiment_name": "xgboost-churn-v3",
  "model_type": "XGBClassifier",
  "hyperparameters": {
    "n_estimators": 200,
    "max_depth": 6,
    "learning_rate": 0.05
  },
  "hpo_enabled": false
}
```

Required fields:
- `experiment_name` — string
- `model_type` — string
- `hyperparameters` — object (key-value pairs)

---

## Gates

### EC001 — spec-valid
Reads `experiment-spec.json`. Hard-fails if missing. Required: `experiment_name`, `model_type`, `hyperparameters` (object).

BAD: `experiment-spec.json` missing or `hyperparameters` is an array instead of object.
GOOD: all three fields present.

### EC002 — config-file-format
An external config file must exist: `config.yaml`, `params.yaml`, `config.json`, `params.json`, `hparams.yaml`, or similar. Configuration must live in a file, not only inside Python source code.

BAD: hyperparameters only inside `.py` files, no external config file.
GOOD:
```yaml
# config.yaml
n_estimators: 200     # number of boosting rounds
max_depth: 6          # tree depth
learning_rate: 0.05   # step shrinkage
random_seed: 42
python_version: "3.10"
```
Escape: `configInCode: true` in spec (when config dict is constructed in code).

### EC003 — all-hyperparams-documented
For YAML config files: numeric params need inline `#` comments on the same line.
For JSON config files: numeric params need `_doc` or `_description` companion keys.
At least 50% of numeric parameters must be documented (gate skips if ≤2 numeric params).

BAD (YAML):
```yaml
n_estimators: 200
max_depth: 6
```
GOOD (YAML):
```yaml
n_estimators: 200  # boosting rounds — higher = more capacity, slower training
max_depth: 6       # tree depth — controls overfitting (6 is typically safe)
```
GOOD (JSON):
```json
{
  "n_estimators": 200,
  "n_estimators_doc": "boosting rounds — higher = more capacity",
  "max_depth": 6,
  "max_depth_doc": "tree depth — controls overfitting"
}
```
Escape: `paramsDocumentedExternally: true` in spec.

### EC004 — reproducibility-params
Config files must contain BOTH:
1. Random seed: `random_seed`, `seed`, or `random_state` key with a value
2. Environment version: `python_version`, `requirements_file`, or `framework_version`

BAD: config with hyperparameters but no seed or environment pins.
GOOD:
```yaml
random_seed: 42
python_version: "3.10"
framework_version: "xgboost==1.7.0"
n_estimators: 200
```

### EC005 — no-hardcoded-hyperparams
Hyperparameter names with literal values in model calls are blocked when no config-loading is present. Blocked param names: `n_estimators`, `max_depth`, `learning_rate`, `lr`, `epochs`, `batch_size`, `hidden_size`, `num_leaves`, `min_samples_leaf`, `C`, `alpha`.

If any config loading is detected (`yaml.safe_load`, `json.load`, `argparse.ArgumentParser`, `OmegaConf.load`, `DictConfig`), the gate passes — hardcoded values may be defaults.

BAD:
```python
# No config loading anywhere
model = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05)
```
GOOD:
```python
with open("config.yaml") as f:
    config = yaml.safe_load(f)
model = XGBClassifier(**config["hyperparameters"])
```
Escape: `# @hardcoded-ok` on the specific line.

### EC006 — search-space-defined
When `spec.hpo_enabled: true` OR HPO imports are detected (`optuna`, `ray.tune`, `hyperopt`, `GridSearchCV`, `RandomizedSearchCV`), a `search_space` must be defined.

BAD:
```python
import optuna
# no search_space defined
def objective(trial): ...
```
GOOD:
```python
search_space = {
    "n_estimators": trial.suggest_int("n_estimators", 100, 500),
    "max_depth":    trial.suggest_int("max_depth", 3, 10),
    "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
}
```
Escape: `searchSpaceExternal: true` in spec.

### EC007 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### EC008 — contract-experiment-config
Final contract check (RULES array — no escape hatch):
- External YAML or JSON config file exists in the directory
- `random_state/seed/random_seed: \d+` present in config file (numeric seed value)

---

## What This Compiler Never Forgives

- `experiment-spec.json` missing (EC001 hard-fails)
- `experiment_name`, `model_type`, or `hyperparameters` missing (EC001)
- No external config file (`config.yaml`/`params.yaml`/etc.) (EC002)
- More than 50% of numeric params undocumented in YAML/JSON (EC003, when >2 params)
- No `random_seed`/`seed`/`random_state` in config (EC004)
- No `python_version`/`requirements_file`/`framework_version` in config (EC004)
- Hardcoded hyperparameter values in model calls without any config loading (EC005)
- HPO imports without `search_space` definition (EC006)
- TODO/FIXME/HACK/XXX anywhere (EC007)
- No external config file or no numeric seed in config (EC008)
