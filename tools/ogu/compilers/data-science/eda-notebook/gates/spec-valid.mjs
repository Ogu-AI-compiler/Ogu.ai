import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * EN001 — spec-valid
 * Validates that eda-spec.json exists and contains all required fields.
 *
 * Why:
 * - An EDA notebook without a declared target variable produces analysis
 *   that may be irrelevant to the modelling goal. The target column drives
 *   correlation analysis, class balance checks, and distribution priorities.
 * - Without declared analysis_goals, the notebook has no success criteria:
 *   it is exploration with no defined exit condition.
 * - Machine-readable specs enable cross-project EDA comparison and pattern
 *   recognition (e.g., "show me all EDAs for classification on tabular data").
 *
 * Escape hatch: none — all non-trivial EDA notebooks require a spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'eda-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'EN001', message: 'eda-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'EN001', message: 'eda-spec.json is invalid JSON' }; }

  const required = ['dataset', 'target_variable', 'analysis_goals'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'EN001', message: `eda-spec.json missing: ${missing.join(', ')}` };
  }

  if (!Array.isArray(spec.analysis_goals) || spec.analysis_goals.length === 0) {
    return { pass: false, code: 'EN001', message: 'analysis_goals must be a non-empty array of goal strings' };
  }

  return { pass: true, code: 'EN001', message: `Spec valid: EDA on "${spec.dataset}", target: "${spec.target_variable}"` };
}
