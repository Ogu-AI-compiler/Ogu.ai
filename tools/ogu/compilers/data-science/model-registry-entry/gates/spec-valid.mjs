import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * MR001 — spec-valid
 * Validates that registry-spec.json exists and contains all required fields.
 *
 * Why:
 * - A registry entry without a performance threshold has no deployment gate:
 *   any model, regardless of quality, would pass registration.
 * - Declaring primary_metric and performance_threshold before training prevents
 *   post-hoc metric selection: the metric is committed to before results are seen.
 * - The version field enables semantic versioning enforcement — registry gates
 *   can reject non-semver versions or version regressions.
 *
 * Escape hatch: none — all production model registry entries need a spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'registry-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'MR001', message: 'registry-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'MR001', message: 'registry-spec.json is invalid JSON' }; }

  const required = ['model_name', 'version', 'performance_threshold', 'primary_metric'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'MR001', message: `registry-spec.json missing: ${missing.join(', ')}` };
  }

  return { pass: true, code: 'MR001', message: `Spec valid: "${spec.model_name}" v${spec.version}` };
}
