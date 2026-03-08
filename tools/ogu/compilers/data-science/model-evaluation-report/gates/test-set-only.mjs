import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ME001 — test-set-only
 * Final model evaluation metrics must be computed on the test set only.
 * Training or validation set metrics must not be presented as final performance.
 *
 * Why:
 * - Training metrics measure memorization, not generalization. A model with
 *   0.99 training accuracy and 0.65 test accuracy is severely overfit.
 * - Validation metrics guide model selection (hyperparameter tuning, early
 *   stopping) — they are "used up" in the process. The model has been
 *   implicitly optimized against them; they are no longer unbiased estimates.
 * - Only the test set — held out throughout training AND validation — gives
 *   an unbiased estimate of production performance.
 * - The most common mistake: evaluating on X_val or X_train in the final
 *   report, often because splitting the code is harder than re-using existing
 *   variables. The cost: shipping a model with systematically optimistic metrics.
 *
 * Detection: checks that final metric calls (accuracy_score, f1_score, etc.)
 * use _test variables, not _train or _val.
 *
 * Escape hatch: # @train-eval-ok: <reason> if training metrics must appear
 * (e.g., training curve plot that includes train metrics for comparison).
 */

const METRIC_CALLS = [
  /accuracy_score\s*\(/,
  /f1_score\s*\(/,
  /precision_score\s*\(/,
  /recall_score\s*\(/,
  /roc_auc_score\s*\(/,
  /mean_squared_error\s*\(/,
  /mean_absolute_error\s*\(/,
  /r2_score\s*\(/,
  /classification_report\s*\(/,
];

// Matches metric calls using training or validation predictions
const TRAIN_EVAL_RE = /(?:accuracy|f1|precision|recall|roc_auc|mse|mae|r2)_score\s*\(\s*y_(?:train|val|valid)\b/;
const REPORT_ON_TRAIN_RE = /classification_report\s*\(\s*y_(?:train|val|valid)\b/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'ME001', message: 'No Python files — test-set check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (/@train-eval-ok/.test(line) || (i > 0 && /@train-eval-ok/.test(lines[i - 1]))) continue;

      if (TRAIN_EVAL_RE.test(line) || REPORT_ON_TRAIN_RE.test(line)) {
        violations.push(`${file}:${i + 1} — ${trimmed.slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'ME001',
      message: `${violations.length} metric(s) computed on training/validation set`,
      detail: violations.slice(0, 5).join('\n') +
        '\n\nFinal evaluation must use test set:\n' +
        '  y_pred = model.predict(X_test)  # NOT X_train or X_val\n' +
        '  print(f"Test F1: {f1_score(y_test, y_pred):.4f}")\n\n' +
        'Training metrics in learning curves are OK — add # @train-eval-ok: learning curve',
    };
  }

  return { pass: true, code: 'ME001', message: 'Final metrics computed on test set only' };
}
