---
name: model-registry-entry
description: Compiler skill for the model-registry-entry compiler. Activates when producing model-registry-entry-artifact.json. Gates: MR001–MR009. Hard-fails when spec missing.
---

# model-registry-entry — Compiler Skill

## What This Compiler Does

Compiles model registry entries — validates spec structure (name, version, performance threshold, primary metric), requires complete metadata in `model-metadata.json`, requires model card link, requires performance threshold verification against actual metrics, requires model artifact to exist on disk or remote, requires semantic versioning with lifecycle stage, and requires a reproducibility identifier linking the artifact to its training run.

**Upstream dependency:** none (but cross-checks `model-card` artifact)
**Output artifact:** `model-registry-entry-artifact.json`
**IR identifier:** `MODEL_REGISTRY:{project}`

---

## Files Required

**`registry-spec.json`**:
```json
{
  "model_name": "churn-predictor",
  "version": "v3.0.0",
  "performance_threshold": 0.85,
  "primary_metric": "f1_score",
  "artifact_path": "artifacts/pipeline.joblib"
}
```

**`model-metadata.json`**:
```json
{
  "model_version": "v3.0.0",
  "trained_at": "2024-01-15T14:22:00Z",
  "algorithm": "XGBClassifier",
  "metrics": { "f1_score": 0.887, "roc_auc": 0.921 },
  "training_data_version": "2024-01-14",
  "run_id": "mlflow-run-abc123def456",
  "stage": "staging",
  "model_card_path": "../../model-card/MODEL_CARD.md"
}
```

---

## Gates

### MR001 — spec-valid
Reads `registry-spec.json`. Hard-fails if missing. Required: `model_name`, `version`, `performance_threshold`, `primary_metric`. No escape hatch.

BAD: spec missing or `performance_threshold` absent.
GOOD: all four fields present.

### MR002 — metadata-complete (labeled MR002 in code)
`model-metadata.json` must exist and contain:
- `model_version` — string
- `trained_at` — ISO timestamp
- `algorithm` — model algorithm name
- `metrics` — non-empty object with performance metric values
- At least one lineage field: `training_data_version`, `training_data_hash`, `dataset_version`, or `data_hash`

BAD: metadata missing `trained_at` or `metrics` is empty.
GOOD:
```json
{
  "model_version": "v3.0.0",
  "trained_at": "2024-01-15T14:22:00Z",
  "algorithm": "XGBClassifier",
  "metrics": { "f1_score": 0.887 },
  "training_data_version": "2024-01-14"
}
```
Escape: `metadataMinimal: true` in spec (prototype/experimental models).

### MR003 — model-card-linked (labeled MR003 in code)
`model-metadata.json` must include `model_card_path` pointing to an existing model card `.md` file.

BAD: no `model_card_path` in metadata.
BAD: `model_card_path` points to a non-existent file.
GOOD:
```json
{ "model_card_path": "../../model-card/MODEL_CARD.md" }
```
Escape: `noModelCard: true` in spec (internal utility models only).

### MR004 — performance-threshold (labeled MR004 in code)
Actual metric in `model-metadata.json` must meet or exceed `performance_threshold` in spec.

Gate compares: `metadata.metrics[spec.primary_metric] >= spec.performance_threshold`

BAD: `primary_metric: "f1_score"`, `performance_threshold: 0.85`, but `metadata.metrics.f1_score: 0.81`.
GOOD: `f1_score: 0.887 >= 0.85` → passes.
Escape: `bootstrapMode: true` in spec (first-ever registration with no prior threshold).

### MR005 — model-serialized (labeled MR001 in code)
Model artifact must exist. Either local file (`.joblib`, `.pkl`, `.pickle`, `.pt`, `.pth`, `.onnx`, `.h5`, `.pb`, `.bin`, `.model`) or declared as remote.

BAD: `artifact_path: "artifacts/model.joblib"` but file doesn't exist on disk.
GOOD:
```json
{ "artifact_path": "artifacts/pipeline.joblib" }  // file exists locally
// OR
{ "artifactRemote": true, "artifact_uri": "s3://bucket/models/v3/pipeline.onnx" }
```
Escape: `artifactRemote: true` in spec (S3/GCS/MLflow artifact store).

### MR006 — model-version-tagged (labeled MR005 in code)
`model-metadata.json` must declare:
1. `model_version` matching semver format (`1.2.3` or `v1.2.3`)
2. `stage` one of: `development`, `staging`, `production`, `archived`, `champion`, `challenger`, `shadow`

BAD: `model_version: "latest"` — not semver.
BAD: `stage: "prod"` — not in valid list.
GOOD:
```json
{ "model_version": "v3.0.0", "stage": "staging" }
```

### MR007 — reproducibility-hash (labeled MR006 in code)
`model-metadata.json` must contain at least one reproducibility identifier (at top level, under `training`, or under `provenance`):
- `run_id` — MLflow run ID
- `git_commit` — SHA of training code
- `config_hash` — SHA-256 of training config
- `training_run_id` — orchestrator run ID
- `dvc_run_id` — DVC pipeline run ID
- `mlflow_run_id` / `wandb_run_id`

BAD: metadata with metrics and version but no reproducibility link.
GOOD:
```json
{ "run_id": "a1b2c3d4e5f6...", "git_commit": "abc123def456..." }
```

### MR008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.py`, `.json`, `.yaml`, `.yml`, `.ipynb` files.

### MR009 — contract-registry
Final contract check (RULES array — no escape hatch):
- A local model artifact file exists (`.joblib`/`.pkl`/`.onnx`/`.pt`/`.h5`) OR `artifactRemote: true`
- `model-metadata.json` exists

---

## What This Compiler Never Forgives

- `registry-spec.json` missing (MR001 hard-fails)
- `model_name`, `version`, `performance_threshold`, or `primary_metric` missing (MR001)
- `model-metadata.json` missing (MR002, MR009)
- `model_version`, `trained_at`, `algorithm`, or `metrics` missing in metadata (MR002)
- `metrics` is empty object (MR002)
- No lineage field (`training_data_version`/`training_data_hash`) in metadata (MR002)
- No `model_card_path` in metadata (MR003)
- `model_card_path` file does not exist (MR003)
- Actual metric below `performance_threshold` (MR004)
- Artifact file declared but not found on disk (MR005)
- `model_version` not semver format (MR006)
- `stage` not in valid lifecycle stage list (MR006)
- No reproducibility identifier in metadata (MR007)
- TODO/FIXME/HACK/XXX anywhere (MR008)
- No local artifact and no `artifactRemote: true` (MR009)
