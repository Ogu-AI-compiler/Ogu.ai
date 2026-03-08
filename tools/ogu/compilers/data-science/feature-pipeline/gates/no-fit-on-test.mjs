import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FP002 — no-fit-on-test
 * Feature pipeline transformers must not be fitted on test or validation data.
 *
 * Why: identical to MT003 reasoning but at the feature pipeline level.
 * Feature pipelines are often refactored separately from training scripts,
 * creating a second surface for this bug to appear.
 *
 * - This gate checks specifically for fit() calls on _test/_val variables
 *   within feature pipeline files (not training scripts).
 * - A common mistake: a separate preprocessing notebook that "prepares"
 *   the test set by fitting new transformers on it.
 * - When a Pipeline is used, sklearn prevents this automatically — but
 *   Pipeline-less pipelines must be checked manually.
 *
 * Escape hatch: # @fit-test-ok: <reason> for legitimate test-data fitting
 * (e.g., computing test-distribution statistics for drift baselines, clearly
 * isolated from the training pipeline path).
 */

const FIT_TEST_RE = /\.fit(?:_transform)?\s*\(\s*(?:X_test|x_test|test_X|X_val|x_val|val_X|test_data|val_data)/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'FP002', message: 'No Python files — fit-on-test check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@fit-test-ok/.test(line) || (i > 0 && /@fit-test-ok/.test(lines[i - 1]))) continue;

      if (FIT_TEST_RE.test(line)) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'FP002',
      message: `${violations.length} transformer(s) fitted on test/validation data`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nTransformers must be fitted on training data only:\n' +
        '  scaler.fit(X_train)           # fit on train\n' +
        '  X_train_s = scaler.transform(X_train)\n' +
        '  X_test_s  = scaler.transform(X_test)   # transform only\n\n' +
        'Or use Pipeline which enforces this automatically.',
    };
  }

  return { pass: true, code: 'FP002', message: 'No transformers fitted on test/validation data' };
}
