/**
 * Why:
 * Feature transformers must be fit exclusively on training data. Fitting on
 * the full dataset (train + validation + test) causes data leakage: the model
 * indirectly "sees" test statistics (mean, variance, category frequencies)
 * during training, producing optimistic evaluation metrics that don't hold
 * in production.
 *
 * The correct pattern is always:
 *   1. Split first → get X_train, X_test
 *   2. Fit transformers on X_train only
 *   3. Transform X_test with the already-fit transformer
 *
 * This gate detects standalone transformer.fit(df) or fit(X) on the full
 * dataset outside an sklearn Pipeline. When wrapped in a Pipeline, the
 * framework guarantees fit-only-on-train when calling pipeline.fit(X_train).
 *
 * Escape hatch: add `# @fit-on-full-ok: <reason>` on the same line as any
 * fit() call that is legitimately applied to full data (e.g., vocabulary
 * building for an embedding layer in an unsupervised context).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Transformers that must be fit on train only
const TRANSFORMER_RE = /\b(scaler|encoder|imputer|normalizer|binarizer|discretizer|transformer|vectorizer|tfidf|pca|svd|lda)\b/i;
// fit / fit_transform calls
const FIT_CALL_RE    = /\.fit(?:_transform)?\s*\(/;
// Full-dataset variable names (not train-specific)
const FULL_DATA_RE   = /\(\s*(?:df|data|X|features|dataset)\s*[,)]/;
// Train-specific variable names
const TRAIN_DATA_RE  = /\(\s*(?:X_train|x_train|train_X|features_train|train_features|df_train)\s*[,)]/;
// Pipeline.fit() — safe pattern
const PIPELINE_FIT_RE = /\b(?:pipeline|pipe|clf|model|estimator)\.fit\s*\(/;

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: true, code: 'FP006', message: 'No Python files — skipped', skipped: true };

  const violations = [];

  for (const f of pyFiles) {
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('#')) continue;
      if (/@fit-on-full-ok/.test(line)) continue;  // escape hatch

      if (TRANSFORMER_RE.test(line) && FIT_CALL_RE.test(line) && FULL_DATA_RE.test(line)) {
        // Check it's not inside a Pipeline.fit() context
        if (!PIPELINE_FIT_RE.test(line) && !TRAIN_DATA_RE.test(line)) {
          violations.push(`${f}:${i + 1}: ${line.trim()}`);
        }
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'FP006',
      message: `${violations.length} transformer(s) fit on full dataset — potential data leakage`,
      detail: violations.join('\n') + '\n\n' +
              'Fix: fit on X_train only, or wrap in sklearn Pipeline:\n' +
              '  scaler.fit(X_train)           # ✓ correct\n' +
              '  pipeline.fit(X_train, y_train) # ✓ Pipeline handles train-only fit\n' +
              '  scaler.fit(df)                # ✗ leaks test distribution into training\n' +
              'If legitimate, add # @fit-on-full-ok: <reason> on the line.',
    };
  }
  return { pass: true, code: 'FP006', message: 'All transformers fit within Pipeline or on training data only' };
}
