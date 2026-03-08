import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ME002 — no-eval-leakage
 * Evaluation code must not use test set statistics to transform test features.
 *
 * Why:
 * - Even when splitting correctly, data leakage can occur during evaluation:
 *   computing test set statistics (mean, std) to normalize test data introduces
 *   future-data knowledge into the evaluation.
 * - Correct pattern: fit scaler on training data, apply fitted scaler to test data.
 * - Incorrect pattern: scaler.fit_transform(X_test) — this fits a NEW scaler
 *   on test data, using test statistics. The model trained on differently-scaled
 *   features will produce wrong predictions.
 * - A subtler leak: recomputing fill values from X_test (df['col'].fillna(X_test['col'].mean()))
 *   instead of using the training set mean.
 *
 * Detection: fit_transform() called on _test variables, or normalization
 * using test-set statistics without a pre-fitted transformer.
 *
 * Escape hatch: # @eval-transform-ok: <reason> for legitimate test-data operations
 * that don't introduce leakage (e.g., converting dtypes, reshaping).
 */

const FIT_TRANSFORM_TEST_RE = /fit_transform\s*\(\s*(?:X_test|x_test|test_|df_test)/;
const TEST_STATS_RE          = /(?:X_test|x_test|test_)\s*\.\s*(?:mean|std|median|quantile)\s*\(\)/;
const FILLNA_TEST_STATS_RE   = /fillna\s*\([^)]*(?:X_test|test_)\s*\.\s*(?:mean|median)\s*\(\)/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'ME002', message: 'No Python files — eval leakage check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@eval-transform-ok/.test(line) || (i > 0 && /@eval-transform-ok/.test(lines[i - 1]))) continue;

      if (FIT_TRANSFORM_TEST_RE.test(line)) {
        violations.push(`${file}:${i + 1} — fit_transform on test data: ${trimmed.slice(0, 80)}`);
      } else if (FILLNA_TEST_STATS_RE.test(line)) {
        violations.push(`${file}:${i + 1} — fillna using test statistics: ${trimmed.slice(0, 80)}`);
      } else if (TEST_STATS_RE.test(line)) {
        violations.push(`${file}:${i + 1} — computing test-set statistics: ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'ME002',
      message: `${violations.length} evaluation leakage pattern(s)`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nCorrect pattern:\n' +
        '  # Fit transformer on TRAIN set only\n' +
        '  scaler = StandardScaler().fit(X_train)\n' +
        '  # Apply fitted transformer to TEST (no re-fitting)\n' +
        '  X_test_scaled = scaler.transform(X_test)\n\n' +
        'NOT:\n' +
        '  X_test_scaled = scaler.fit_transform(X_test)  # leakage!',
    };
  }

  return { pass: true, code: 'ME002', message: 'No evaluation leakage detected' };
}
