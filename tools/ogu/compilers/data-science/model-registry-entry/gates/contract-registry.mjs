import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MR009 — contract-registry
 * Verifies that model registry entries satisfy the contract:
 * model artifact exists on disk and metadata file is present.
 *
 * Why:
 * - A registry entry without a model artifact is a phantom: it points to
 *   a model that cannot be loaded, deployed, or reproduced. The artifact
 *   file is the actual deliverable; the registry entry is its catalog record.
 * - model-metadata.json is required for model governance: it contains
 *   lineage information (training data version, git commit, config hash)
 *   that enables audit and rollback. Without it, the model is a black box.
 * - These two requirements are the minimum viable registry entry: artifact
 *   (can be loaded) and metadata (can be audited).
 *
 * Escape hatch: add "artifactRemote": true in registry-spec.json if the
 * artifact is stored in a remote registry (S3, GCS, MLflow, W&B artifacts).
 */

export async function run({ dir }) {
  const ARTIFACT_EXTS = ['.joblib', '.pkl', '.pickle', '.onnx', '.pt', '.pth', '.h5', '.pb', '.bin', '.model'];
  const hasLocalArtifact = readdirSync(dir).some(f => ARTIFACT_EXTS.some(ext => f.endsWith(ext)));
  const hasMetadata = existsSync(join(dir, 'model-metadata.json'));

  // Check for remote artifact escape hatch
  const specPath = join(dir, 'registry-spec.json');
  if (!hasLocalArtifact && existsSync(specPath)) {
    try {
      const spec = JSON.parse(readFileSync(specPath, 'utf8'));
      if (spec.artifactRemote === true) {
        // Remote artifact — skip local file check, but still require metadata
        if (!hasMetadata) {
          return {
            pass: false, code: 'MR009',
            message: 'model-metadata.json not found',
            detail: 'Even remote artifacts require a local metadata file for governance.',
          };
        }
        return { pass: true, code: 'MR009', message: 'Remote artifact acknowledged, metadata present' };
      }
    } catch {}
  }

  const violations = [];
  if (!hasLocalArtifact) {
    violations.push('[has-artifact] Model artifact (.joblib, .pkl, .onnx, .pt, .h5) not found in directory');
  }
  if (!hasMetadata) {
    violations.push('[has-metadata] model-metadata.json not found');
  }

  if (violations.length) {
    return {
      pass: false, code: 'MR009',
      message: `Contract violations: ${violations.length}`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'MR009', message: 'All model registry contract rules passed' };
}
