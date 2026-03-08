import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * FS001 — spec-valid
 * Validates that feature-store-spec.json exists and each feature has name + dtype.
 *
 * Why:
 * - A feature group without typed feature definitions cannot be versioned or
 *   compared: adding a feature, changing a dtype, or renaming a feature are
 *   all breaking changes that require schema evolution tracking.
 * - The entity_key declaration is required for join keys: without it, feature
 *   retrieval cannot be validated for correctness.
 * - Machine-readable specs enable automated feature catalog population,
 *   lineage tracking, and training-serving skew detection.
 *
 * Escape hatch: none — all feature groups need a machine-readable spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'feature-store-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'FS001', message: 'feature-store-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'FS001', message: 'feature-store-spec.json is invalid JSON' }; }

  const required = ['feature_group', 'features', 'entity_key', 'version'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'FS001', message: `feature-store-spec.json missing: ${missing.join(', ')}` };
  }

  if (!Array.isArray(spec.features) || spec.features.length === 0) {
    return { pass: false, code: 'FS001', message: 'features must be a non-empty array' };
  }

  const badFeatures = spec.features.filter(f => !f.name || !f.dtype);
  if (badFeatures.length) {
    return {
      pass: false, code: 'FS001',
      message: `${badFeatures.length} feature(s) missing required fields — each needs name and dtype`,
    };
  }

  return { pass: true, code: 'FS001', message: `Spec valid: feature group "${spec.feature_group}", v${spec.version}, ${spec.features.length} features` };
}
