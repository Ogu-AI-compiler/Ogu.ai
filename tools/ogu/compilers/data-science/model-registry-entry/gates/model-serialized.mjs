import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MR001 — model-serialized
 * The model registry entry must reference a valid, existing model artifact file.
 *
 * Why:
 * - A registry entry that points to a non-existent artifact is a dangling reference.
 *   Deployment automation that reads the registry will fail at artifact download.
 * - Artifact path must be declared in the spec AND verified to exist.
 *   A declared path that was never written (training failed silently) is
 *   equally broken.
 * - Artifact format matters for serving compatibility:
 *   - joblib: sklearn-specific, fast load, requires same sklearn version
 *   - ONNX: cross-framework, cross-language, recommended for production
 *   - SavedModel/torch.pt: framework-specific
 *   The format must match the serving infrastructure.
 *
 * Escape hatch: add "artifactRemote": true if the artifact is in a remote
 * store (S3, GCS, MLflow registry) — local path check is skipped.
 */

const VALID_EXTENSIONS = new Set(['.joblib', '.pkl', '.pickle', '.pt', '.pth', '.onnx', '.h5', '.pb', '.bin', '.model']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'registry-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'MR001', message: 'registry-spec.json not readable' }; }

  if (spec.artifactRemote === true) {
    const uri = spec.artifact_uri ?? 'remote URI not declared';
    return { pass: true, code: 'MR001', message: `Artifact stored remotely: ${uri}`, skipped: true };
  }

  const artifactPath = spec.artifact_path ?? spec.model_path ?? spec.artifact;
  if (!artifactPath) {
    return {
      pass: false, code: 'MR001',
      message: 'No artifact_path declared in registry-spec.json',
      detail: 'Add:\n  "artifact_path": "artifacts/pipeline.joblib"\nor\n  "artifactRemote": true, "artifact_uri": "s3://bucket/models/v1/model.onnx"',
    };
  }

  const ext = '.' + String(artifactPath).split('.').pop().toLowerCase();
  if (!VALID_EXTENSIONS.has(ext)) {
    return {
      pass: false, code: 'MR001',
      message: `Unexpected artifact extension: "${ext}"`,
      detail: `Valid formats: ${[...VALID_EXTENSIONS].join(', ')}`,
    };
  }

  const fullPath = join(dir, String(artifactPath));
  if (!existsSync(fullPath)) {
    return {
      pass: false, code: 'MR001',
      message: `Artifact file not found: ${artifactPath}`,
      detail: 'Ensure the training pipeline writes the artifact before registry entry is validated.',
    };
  }

  return {
    pass: true, code: 'MR001',
    message: `Artifact exists: ${artifactPath}`,
  };
}
