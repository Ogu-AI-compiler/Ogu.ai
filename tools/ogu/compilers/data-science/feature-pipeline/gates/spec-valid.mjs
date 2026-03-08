import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * FP001 — spec-valid
 * Validates that feature-pipeline-spec.json exists and contains all required fields.
 *
 * Why:
 * - A feature pipeline without declared inputs and outputs is a black box:
 *   downstream consumers cannot verify which features are available or what
 *   transformers were applied.
 * - Declaring the target column enables target leakage detection gates. Without
 *   the spec declaring target, the leakage gate cannot verify the pipeline.
 * - Declaring transformers enables automated compatibility checks between
 *   training and serving feature pipelines (training-serving skew prevention).
 *
 * Escape hatch: none — all feature pipelines need a machine-readable spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'feature-pipeline-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'FP001', message: 'feature-pipeline-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'FP001', message: 'feature-pipeline-spec.json is invalid JSON' }; }

  const required = ['features', 'target', 'transformers'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'FP001', message: `feature-pipeline-spec.json missing: ${missing.join(', ')}` };
  }

  if (!Array.isArray(spec.features) || spec.features.length === 0) {
    return { pass: false, code: 'FP001', message: 'features must be a non-empty array of feature names' };
  }

  return { pass: true, code: 'FP001', message: `Spec valid: ${spec.features.length} features, target: "${spec.target}"` };
}
