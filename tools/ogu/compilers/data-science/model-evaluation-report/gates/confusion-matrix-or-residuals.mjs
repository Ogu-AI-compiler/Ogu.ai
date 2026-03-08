import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ME005 — confusion-matrix-or-residuals
 * Classification evaluations must include a confusion matrix.
 * Regression evaluations must include a residuals analysis.
 *
 * Why:
 * - Aggregate metrics (F1, accuracy, MAE) collapse information.
 *   A confusion matrix reveals WHICH classes are confused — critical for
 *   asymmetric error costs (false negative in fraud detection is much worse
 *   than a false positive).
 * - Residuals plots reveal systematic model failures:
 *   - Heteroscedasticity (variance increases with predicted value)
 *   - Non-linearity (U-shaped residuals pattern)
 *   - Outliers (extreme residuals = specific failure modes)
 *   These patterns are invisible in MAE/RMSE alone.
 * - For classification: confusion_matrix shows exactly where predictions fail.
 *   "0.78 F1" is less useful than knowing you have 40% false negatives on class 2.
 *
 * Task detection: uses spec.task or code heuristics (LogisticRegression →
 * classification, LinearRegression → regression).
 *
 * Escape hatch: add "skipConfusionMatrix": true or "skipResidualsPlot": true
 * to eval-spec.json with documented rationale.
 */

const CLASSIFICATION_TASKS = new Set(['classification', 'binary_classification', 'multiclass', 'multilabel']);
const REGRESSION_TASKS     = new Set(['regression', 'forecasting', 'time_series']);

const CONFUSION_PATTERNS = [
  /confusion_matrix\s*\(/,
  /ConfusionMatrixDisplay/,
  /plot_confusion_matrix/,
  /seaborn.*heatmap.*confusion|heatmap.*cm\b/,
];

const RESIDUAL_PATTERNS = [
  /residual/i,
  /y_pred\s*-\s*y_test|y_test\s*-\s*y_pred/,
  /predicted\s*-\s*actual|actual\s*-\s*predicted/i,
  /plot_residuals|residuals_plot/,
  /scatter.*resid|resid.*scatter/i,
];

// Code heuristics for task type
const CLASSIFICATION_CODE_RE = /LogisticRegression|RandomForestClassifier|XGBClassifier|f1_score|roc_auc|classification_report/;
const REGRESSION_CODE_RE     = /LinearRegression|Ridge|Lasso|mean_squared_error|mean_absolute_error|r2_score/;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'eval-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'ME005', message: 'eval-spec.json not readable' }; }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  const content = files.length
    ? files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n')
    : '';

  // Determine task type
  let task = (spec.task ?? '').toLowerCase();
  if (!task && content) {
    if (CLASSIFICATION_CODE_RE.test(content)) task = 'classification';
    else if (REGRESSION_CODE_RE.test(content))   task = 'regression';
  }

  if (CLASSIFICATION_TASKS.has(task)) {
    if (spec.skipConfusionMatrix === true) {
      return { pass: true, code: 'ME005', message: 'skipConfusionMatrix: true — skipped', skipped: true };
    }
    const hasConfusion = CONFUSION_PATTERNS.some(p => p.test(content));
    if (!hasConfusion) {
      return {
        pass: false, code: 'ME005',
        message: 'Classification evaluation missing confusion matrix',
        detail: '  from sklearn.metrics import ConfusionMatrixDisplay\n' +
          '  ConfusionMatrixDisplay.from_predictions(y_test, y_pred)\n' +
          '  plt.title("Confusion Matrix — Test Set")\n' +
          '  plt.savefig("confusion_matrix.png")',
      };
    }
    return { pass: true, code: 'ME005', message: 'Confusion matrix present in classification evaluation' };
  }

  if (REGRESSION_TASKS.has(task)) {
    if (spec.skipResidualsPlot === true) {
      return { pass: true, code: 'ME005', message: 'skipResidualsPlot: true — skipped', skipped: true };
    }
    const hasResiduals = RESIDUAL_PATTERNS.some(p => p.test(content));
    if (!hasResiduals) {
      return {
        pass: false, code: 'ME005',
        message: 'Regression evaluation missing residuals analysis',
        detail: '  residuals = y_test - y_pred\n' +
          '  plt.scatter(y_pred, residuals)\n' +
          '  plt.axhline(0, color="red", linestyle="--")\n' +
          '  plt.xlabel("Predicted"); plt.ylabel("Residuals")\n' +
          '  plt.title("Residuals vs Predicted — Test Set")',
      };
    }
    return { pass: true, code: 'ME005', message: 'Residuals analysis present in regression evaluation' };
  }

  // Unknown task type
  return {
    pass: true, code: 'ME005',
    message: `Task type "${task || 'unknown'}" — confusion matrix/residuals check skipped`,
    skipped: true,
  };
}
