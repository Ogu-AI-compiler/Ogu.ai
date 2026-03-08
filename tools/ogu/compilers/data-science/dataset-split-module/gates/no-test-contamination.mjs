import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * SP003 — no-test-contamination
 * Test set data must not be used during training or feature engineering.
 *
 * Why:
 * - Test set contamination produces optimistic, non-reproducible results.
 *   The model appears to generalize but has actually seen the test data.
 * - Common contamination patterns:
 *   1. Fitting a scaler on ALL data before splitting:
 *      scaler.fit(X)  # contaminated — test statistics flow into training
 *      X_train, X_test = train_test_split(X)
 *   2. Feature selection on full dataset (SelectKBest on all X)
 *   3. Normalization/standardization using global mean/std
 *   4. Outlier removal based on full dataset statistics
 * - The fix: ALWAYS split first, THEN fit transformers on X_train only.
 *   Apply fitted transformers to X_test via .transform() (not .fit_transform()).
 *
 * This gate looks for the most common anti-pattern: fit() called on an
 * unqualified variable (not _train) before train_test_split.
 *
 * Escape hatch: # @test-use-ok: <reason> for legitimate test-set reads
 * (e.g., logging shapes for debugging, final evaluation only).
 */

// Pattern: .fit() or .fit_transform() on variable that doesn't end in _train
const CONTAMINATED_FIT_RE = /(?:scaler|encoder|imputer|selector|transformer|pipeline)\s*\.\s*fit(?:_transform)?\s*\(\s*(?!.*_train)[Xx]\b/i;

// Pattern for full-data statistics before split
const FULL_STATS_RE = /(?:X|df|data)\s*\.\s*(?:mean|std|median|quantile|describe)\s*\(\)/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'SP003', message: 'No Python files — contamination check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const text  = readFileSync(join(dir, file), 'utf8');
    const lines = text.split('\n');

    // Find train_test_split call line
    const splitIdx = lines.findIndex(l => /train_test_split\s*\(/.test(l));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@test-use-ok/.test(line) || (i > 0 && /@test-use-ok/.test(lines[i - 1]))) continue;

      // Flag: transformer fitted before split on non-_train data
      if (splitIdx > 0 && i < splitIdx && CONTAMINATED_FIT_RE.test(line)) {
        violations.push(`${file}:${i + 1} — fit() before split: ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SP003',
      message: `${violations.length} potential test set contamination(s)`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nFix — split FIRST, then fit:\n' +
        '  X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)\n' +
        '  scaler = StandardScaler()\n' +
        '  X_train_scaled = scaler.fit_transform(X_train)  # fit only on train\n' +
        '  X_test_scaled  = scaler.transform(X_test)       # transform only\n\n' +
        'Or use a sklearn Pipeline which handles this automatically.',
    };
  }

  return { pass: true, code: 'SP003', message: 'No test set contamination detected' };
}
