import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * MT003 — no-fit-on-test
 * Model training scripts must not call .fit() or .fit_transform() on test data.
 *
 * Why:
 * - Fitting on test data is the most severe form of data leakage.
 *   It exposes the model to test set statistics during training, producing
 *   optimistic metrics that disappear in production.
 * - The failure is insidious: metrics look excellent, the model ships,
 *   and production performance is systematically worse than expected.
 *   Root cause analysis is expensive — especially when the bug is subtle.
 * - Common occurrence: developer refactors split code, accidentally changes
 *   X_test to X and doesn't notice because tests don't catch it.
 *
 * Detection: .fit() or .fit_transform() called on _test variables.
 * Does not flag: model.fit(X_train) or pipeline.fit(X_train, y_train).
 * Does flag: scaler.fit(X_test), imputer.fit_transform(X_test).
 *
 * Escape hatch: # @fit-on-test-ok: <reason> for legitimate cases
 * (e.g., fitting a scaler on test data to compute test-distribution statistics
 * for a separate monitoring baseline, clearly isolated from training).
 */

const FIT_ON_TEST_RE = /\.fit(?:_transform)?\s*\(\s*(?:X_test|x_test|test_X|test_data|df_test|data_test)/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'MT003', message: 'No Python files — fit-on-test check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@fit-on-test-ok/.test(line) || (i > 0 && /@fit-on-test-ok/.test(lines[i - 1]))) continue;

      if (FIT_ON_TEST_RE.test(line)) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'MT003',
      message: `${violations.length} .fit() call(s) on test data — critical leakage`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nAll transformers must fit on TRAINING data only:\n' +
        '  scaler.fit(X_train)          # fit on train\n' +
        '  scaler.transform(X_test)     # transform test with train statistics\n' +
        '  # NEVER: scaler.fit(X_test) or scaler.fit_transform(X_test)',
    };
  }

  return { pass: true, code: 'MT003', message: 'No .fit() calls on test data' };
}
