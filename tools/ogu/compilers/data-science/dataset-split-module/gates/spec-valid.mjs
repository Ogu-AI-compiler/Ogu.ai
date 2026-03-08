import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SP001 — spec-valid
 * Validates that split-spec.json exists and split ratios sum to 1.0.
 *
 * Why:
 * - Undeclared split strategy means each engineer picks their own — leading
 *   to evaluation inconsistency across experiments and model versions.
 * - Ratios that don't sum to 1.0 indicate a configuration error: either
 *   some data is unaccounted for (leaked?) or double-counted (biased?).
 * - Declaring the task type unlocks task-aware gate checks (stratification
 *   for classification, temporal ordering for time-series tasks).
 *
 * Escape hatch: none — all supervised learning splits need a spec.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'split-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'SP001', message: 'split-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'SP001', message: 'split-spec.json is invalid JSON' }; }

  const required = ['task', 'train_ratio', 'test_ratio'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'SP001', message: `split-spec.json missing: ${missing.join(', ')}` };
  }

  const total = (spec.train_ratio || 0) + (spec.val_ratio || 0) + (spec.test_ratio || 0);
  if (Math.abs(total - 1.0) > 0.01) {
    return {
      pass: false, code: 'SP001',
      message: `Split ratios must sum to 1.0, got ${total.toFixed(2)} — check train_ratio + val_ratio + test_ratio`,
    };
  }

  return { pass: true, code: 'SP001', message: `Spec valid: ${spec.task}, train=${spec.train_ratio}, test=${spec.test_ratio}` };
}
