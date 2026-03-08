/**
 * Why:
 * Data must be split into train/test sets BEFORE any fitting or transformation
 * is applied. Fitting a scaler, imputer, or encoder on the full dataset before
 * splitting leaks test set statistics (mean, std, category distribution) into
 * the training process — causing optimistic evaluation that fails in production.
 *
 * Detection strategy (line-number based):
 * 1. Find the line number of `train_test_split(` or `KFold.split(`
 * 2. Find the line number of any `.fit(` or `.fit_transform(` call on data
 * 3. If a fit call appears BEFORE the split call → leakage
 *
 * Edge cases:
 * - sklearn Pipeline.fit(X_train): safe, handled by the framework
 * - Fit calls inside a function defined before the split but called after:
 *   this gate performs a linear scan and may produce false positives here;
 *   use the escape hatch in that case.
 * - torch DataLoader or tf.data.Dataset: not applicable, skip
 *
 * Escape hatch: add `# @split-order-ok: <reason>` before any fit call that
 * legitimately precedes the split (e.g., vocabulary from a separate corpus).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SPLIT_RE   = /train_test_split\s*\(|KFold\s*\(|StratifiedKFold\s*\(|GroupKFold\s*\(|TimeSeriesSplit\s*\(/;
const FIT_RE     = /\.(fit|fit_transform)\s*\(/;
const SAFE_FIT_RE = /\b(pipeline|pipe|clf|model|estimator|grid_search|cv)\.(fit|fit_transform)\s*\(/i;
const ESCAPE_RE  = /@split-order-ok/;

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: true, code: 'SP002', message: 'No Python files — skipped', skipped: true };

  const violations = [];

  for (const f of pyFiles) {
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');

    const splitLine = lines.findIndex(l => !l.trim().startsWith('#') && SPLIT_RE.test(l));
    if (splitLine === -1) continue;  // no split call — nothing to check

    for (let i = 0; i < splitLine; i++) {
      const line = lines[i];
      if (line.trim().startsWith('#')) continue;
      if (ESCAPE_RE.test(line)) continue;
      if (i > 0 && ESCAPE_RE.test(lines[i - 1])) continue;
      if (SAFE_FIT_RE.test(line)) continue;  // pipeline fit — safe

      if (FIT_RE.test(line)) {
        violations.push(
          `${f}:${i + 1}: .fit() on line ${i + 1} precedes train_test_split on line ${splitLine + 1}\n` +
          `  ${line.trim().slice(0, 80)}`
        );
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SP002',
      message: `${violations.length} transformer fit(s) detected before data split`,
      detail: violations.join('\n') + '\n\n' +
              'Always split first, then fit:\n' +
              '  X_train, X_test, y_train, y_test = train_test_split(X, y, ...)\n' +
              '  scaler.fit(X_train)          # ✓ fit on train only\n' +
              '  X_test_scaled = scaler.transform(X_test)  # ✓ transform test\n' +
              'Add # @split-order-ok: <reason> to suppress for justified pre-split fits.',
    };
  }
  return { pass: true, code: 'SP002', message: 'Data split precedes all transformer fits' };
}
