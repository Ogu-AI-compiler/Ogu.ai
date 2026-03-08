---
name: model-training-script
description: Compiler skill for the model-training-script compiler. Activates when producing training-artifact.json. Gates: MT001–MT010. Hard-fails when spec missing.
---

# model-training-script — Compiler Skill

## What This Compiler Does

Compiles model training scripts — validates spec structure (task type, config file, metrics), requires main guard, blocks fitting on test data, requires sklearn Pipeline (for sklearn training), requires random seeds for all frameworks used, requires hyperparameters loaded from config (not hardcoded), requires experiment tracking, requires model serialization, and blocks TODO/FIXME markers.

**Upstream dependency:** none
**Output artifact:** `training-artifact.json`
**IR identifier:** `MODEL_TRAINING:{project}`

---

## Spec Shape

```json
{
  "model_type": "XGBClassifier",
  "task": "classification",
  "config_file": "config.yaml",
  "metrics": ["f1_score", "roc_auc"]
}
```

Required fields:
- `model_type` — string
- `task` — one of: `classification`, `regression`, `clustering`, `ranking`, `multi-label`
- `config_file` — string (path to hyperparameter config)
- `metrics` — array of metric names

---

## Gates

### MT001 — spec-valid
Reads `training-spec.json`. Hard-fails if missing. Required: `model_type`, `task`, `config_file`, `metrics`. Task must be in the valid set: `classification`, `regression`, `clustering`, `ranking`, `multi-label`.

BAD: `task: "binary_classification"` — not in valid list (use `classification`).
GOOD: `task: "classification"` with all four fields present.

### MT002 — main-guard (labeled MT002 in code)
Training scripts must have `if __name__ == "__main__"` guard. Scripts without it trigger training on import.

BAD:
```python
pipeline.fit(X_train, y_train)   # top-level execution
joblib.dump(pipeline, "model.joblib")
```
GOOD:
```python
def train(cfg):
    pipeline = build_pipeline(cfg)
    pipeline.fit(X_train, y_train)
    joblib.dump(pipeline, cfg.output_path)

if __name__ == "__main__":
    cfg = parse_args()
    train(cfg)
```
Escape: `# @no-main-guard-ok`.

### MT003 — no-fit-on-test (labeled MT003 in code)
Blocks `.fit()` or `.fit_transform()` on test data variables: `X_test`, `x_test`, `test_X`, `test_data`, `df_test`, `data_test`.

BAD:
```python
scaler.fit(X_test)          # critical leakage — uses test statistics
imputer.fit_transform(X_test)
```
GOOD:
```python
scaler.fit(X_train)
X_test_scaled = scaler.transform(X_test)
```
Escape: `# @fit-on-test-ok: <reason>`.

### MT004 — pipeline-used (labeled MT004 in code)
sklearn training scripts must use a Pipeline. Accepted: `Pipeline(steps=`, `make_pipeline(`, `ColumnTransformer(`.

Auto-skips for PyTorch neural network training (detects `DataLoader`, `optimizer.zero_grad`, `loss.backward`).

BAD:
```python
scaler.fit(X_train)
X_train_s = scaler.transform(X_train)
clf.fit(X_train_s, y_train)  # preprocessing not atomic with model
```
GOOD:
```python
pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("model",  GradientBoostingClassifier(**cfg.model)),
])
pipeline.fit(X_train, y_train)
joblib.dump(pipeline, "artifacts/pipeline.joblib")
```
Escape: `# @no-pipeline-ok: <reason>`.

### MT005 — random-seed-set (labeled MT005 in code)
Seeds must be set for all detected frameworks:
- NumPy (`import numpy`): `np.random.seed(N)`
- Python random (`import random`): `random.seed(N)`
- PyTorch (`import torch`): `torch.manual_seed(N)`
- TensorFlow (`import tensorflow`): `tf.random.set_seed(N)`

BAD:
```python
import numpy as np
import torch
# no seeds set — non-reproducible training
```
GOOD:
```python
def set_seeds(seed: int = 42):
    import random
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)

set_seeds(cfg.random_seed)
```
Escape: `# @no-seed-ok`.

### MT006 — hyperparams-configurable (labeled MT006 in code)
Hyperparameter values in model calls must come from a config loader when no config loading is detected anywhere in the file. Config loading patterns: `yaml.safe_load`, `json.load`, `argparse.ArgumentParser`, `OmegaConf.load`, `DictConfig`.

Blocked hyperparameter names in model calls (when no config loader): `n_estimators`, `max_depth`, `learning_rate`, `num_leaves`, `min_samples_leaf`, `C`, `alpha`, `hidden_size`, `batch_size`, `epochs`.

BAD:
```python
# no yaml.safe_load or argparse anywhere
model = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.05)
```
GOOD:
```python
with open("config.yaml") as f:
    cfg = yaml.safe_load(f)
model = XGBClassifier(**cfg["hyperparameters"])
```
Escape: `# @hardcoded-ok` on the specific line.

### MT007 — experiment-tracked (labeled MT007 in code)
Every training run must be logged to an experiment tracker. Accepted: MLflow, Weights & Biases, Neptune, Comet ML, DVCLive.

Full tracking (run + params + metrics) passes. Partial tracking (any one component) also passes.

BAD: no experiment tracking calls anywhere.
GOOD:
```python
import mlflow
with mlflow.start_run():
    mlflow.log_params(cfg["hyperparameters"])
    mlflow.log_metric("f1", f1_score(y_test, y_pred))
    mlflow.sklearn.log_model(pipeline, "model")
```
Escape: `# @tracking-external: <system>`.

### MT008 — model-serialized (labeled MT008 in code)
Training script must serialize the model. Accepted: `joblib.dump(`, `pickle.dump(`, `model.save(`, `torch.save(`, `torch.jit.save(`, `.save_pretrained(`, `mlflow.*.log_model`, `wandb.log_artifact`, `tf.saved_model.save(`.

BAD: model trained in memory but never saved.
GOOD:
```python
import joblib
joblib.dump(pipeline, "artifacts/pipeline.joblib")
# OR
mlflow.sklearn.log_model(pipeline, "model")
```
Escape: `# @no-serialize-ok: <reason>` (distributed training with separate aggregation step).

### MT009 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### MT010 — contract-model-training
Final contract check (RULES array — no escape hatch):
- Random seed set: `random.seed(/np.random.seed(/torch.manual_seed(/random_state=` present
- Experiment tracking: `mlflow./wandb./neptune./dvclive/comet_ml.` present
- Model serialized: `joblib.dump/pickle.dump/mlflow.*.log_model/torch.save/model.save/save_pretrained` present
- Type hints on functions: `def \w+(...) ->` or `def \w+(...: pd./np./DataFrame/ndarray)`

---

## What This Compiler Never Forgives

- `training-spec.json` missing (MT001 hard-fails)
- `model_type`, `task`, `config_file`, or `metrics` missing (MT001)
- `task` not in valid list (MT001)
- No `if __name__ == "__main__"` guard (MT002)
- `.fit()` or `.fit_transform()` on test data (MT003)
- sklearn training without Pipeline (MT004, unless PyTorch NN detected)
- Framework used but corresponding seed not set (MT005)
- Hardcoded hyperparameters in model calls without config loading (MT006)
- No experiment tracking (MT007)
- Model not serialized to file or registry (MT008)
- TODO/FIXME/HACK/XXX anywhere (MT009)
- Contract violations: no seed, no tracking, no serialization, no type hints (MT010)
