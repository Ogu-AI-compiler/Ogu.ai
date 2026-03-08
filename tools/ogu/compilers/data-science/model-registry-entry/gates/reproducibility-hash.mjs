import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MR006 — reproducibility-hash
 * Registered models must include a reproducibility identifier linking the
 * model artifact to the exact training run, config, and code that produced it.
 *
 * Why:
 * - Model artifacts are opaque binary files (pickle, ONNX, SavedModel).
 *   Without a reproducibility link, there is no way to determine what
 *   data, code, or hyperparameters produced a given artifact.
 * - Incident response requires this: "which training run produced the
 *   model deployed at 14:00?" must be answerable in minutes, not hours.
 * - Regulatory audits (GDPR, financial risk models) require the ability
 *   to reconstruct any production model from source inputs.
 * - Reproducibility links also enable automated re-training: CI can
 *   detect config changes and auto-trigger re-training of affected models.
 *
 * Accepted identifiers (any one suffices):
 * - run_id: experiment tracker run ID (MLflow, W&B)
 * - git_commit: the SHA of the training code
 * - config_hash: SHA-256 of the training config YAML
 * - training_run_id: internal identifier from orchestrator (Airflow DAG run)
 * - dvc_run_id: DVC pipeline run identifier
 */

const REPRO_FIELDS = ['run_id', 'git_commit', 'config_hash', 'training_run_id', 'dvc_run_id', 'mlflow_run_id', 'wandb_run_id'];

export async function run({ dir }) {
  const metaPath = join(dir, 'model-metadata.json');

  if (!existsSync(metaPath)) {
    return { pass: false, code: 'MR006', message: 'model-metadata.json not found' };
  }

  let meta;
  try { meta = JSON.parse(readFileSync(metaPath, 'utf8')); }
  catch { return { pass: false, code: 'MR006', message: 'model-metadata.json not parseable' }; }

  // Check for reproducibility ID at top level or under 'training' key
  const sources = [meta, meta.training ?? {}, meta.provenance ?? {}];
  const found = REPRO_FIELDS.find(f => sources.some(s => s[f]));

  if (!found) {
    return {
      pass: false, code: 'MR006',
      message: 'No reproducibility identifier in model-metadata.json',
      detail: `Add one of: ${REPRO_FIELDS.join(', ')}\n\n` +
        'Examples:\n' +
        '  MLflow: { "run_id": "a1b2c3d4e5f6..." }\n' +
        '  Git:    { "git_commit": "abc123def456..." }\n' +
        '  Config: { "config_hash": "sha256:7f3a..." }\n\n' +
        'Generate config hash in training script:\n' +
        '  import hashlib, yaml\n' +
        '  config_hash = hashlib.sha256(open("config.yaml","rb").read()).hexdigest()',
    };
  }

  const value = sources.find(s => s[found])?.[found];
  return {
    pass: true, code: 'MR006',
    message: `Reproducibility identifier: ${found}=${String(value).slice(0, 12)}...`,
  };
}
