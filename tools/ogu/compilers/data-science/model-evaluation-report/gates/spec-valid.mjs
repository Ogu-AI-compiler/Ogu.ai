import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ME001 — spec-valid
 * Validates that evaluation-spec.json exists and contains all required fields.
 *
 * Why:
 * - An evaluation without a declared primary metric is not a proper evaluation:
 *   any metric can be cherry-picked post-hoc to make the model look good.
 * - Declaring baseline_strategy before running evaluation prevents HARKing
 *   (Hypothesizing After Results are Known): the baseline is committed to
 *   before seeing evaluation results.
 * - Machine-readable specs enable cross-model evaluation comparisons and
 *   automated deployment gates (only promote if primary metric beats baseline).
 *
 * Escape hatch: none — all production model evaluations need a spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'evaluation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'ME001', message: 'evaluation-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'ME001', message: 'evaluation-spec.json is invalid JSON' }; }

  const required = ['task', 'primary_metric', 'baseline_strategy'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'ME001', message: `evaluation-spec.json missing: ${missing.join(', ')}` };
  }

  return { pass: true, code: 'ME001', message: `Spec valid: ${spec.task}, primary metric: ${spec.primary_metric}` };
}
