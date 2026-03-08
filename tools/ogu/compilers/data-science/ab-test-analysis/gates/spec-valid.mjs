import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * AB001 — spec-valid
 * Validates that ab-test-spec.json exists and contains all required fields.
 *
 * Why:
 * - A/B test specs must be declared before data collection, not after seeing
 *   results. Without a spec, primary metrics can be swapped post-hoc to find
 *   a significant result (p-hacking).
 * - Declaring alpha before testing commits the significance threshold. An
 *   analyst who sees p=0.04 and then chooses α=0.05 has not pre-registered.
 * - Declaring treatment_variants ensures all variants are accounted for in
 *   analysis: an undeclared variant that underperformed can be quietly excluded.
 *
 * Escape hatch: none — all A/B tests need a pre-registered spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'ab-test-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'AB001', message: 'ab-test-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'AB001', message: 'ab-test-spec.json is invalid JSON' }; }

  const required = ['experiment_name', 'hypothesis', 'primary_metric', 'alpha', 'treatment_variants'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'AB001', message: `ab-test-spec.json missing: ${missing.join(', ')}` };
  }

  if (typeof spec.alpha !== 'number' || spec.alpha <= 0 || spec.alpha >= 1) {
    return { pass: false, code: 'AB001', message: `alpha must be between 0 and 1, got: ${spec.alpha}` };
  }

  if (!Array.isArray(spec.treatment_variants) || spec.treatment_variants.length === 0) {
    return { pass: false, code: 'AB001', message: 'treatment_variants must be a non-empty array' };
  }

  return { pass: true, code: 'AB001', message: `Spec valid: "${spec.experiment_name}", α=${spec.alpha}, ${spec.treatment_variants.length} variant(s)` };
}
