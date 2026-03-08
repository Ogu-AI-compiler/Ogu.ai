/**
 * Why:
 * Single-metric evaluation is dangerously incomplete. The canonical failure mode:
 * a model achieves 95% accuracy on an imbalanced dataset where 95% of samples
 * belong to the negative class — the model that always predicts "negative"
 * scores 95% accuracy while being completely useless.
 *
 * Required metric sets by task type:
 * - Classification: F1 + precision + recall (or ROC-AUC + average precision)
 * - Regression: RMSE + MAE + R² (three complementary error perspectives)
 * - Ranking: NDCG + MAP or Precision@k
 *
 * Why multiple metrics matter:
 * - Precision and recall have an inherent trade-off; reporting both reveals
 *   whether the model optimizes for one at the expense of the other
 * - RMSE penalizes large errors more than MAE; together they reveal outlier sensitivity
 * - R² reveals explained variance; MAE reveals absolute prediction accuracy
 *
 * Escape hatch: add `# @single-metric-ok: <reason>` if the evaluation context
 * genuinely requires only one metric (e.g., a ranking system where only NDCG matters).
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const CLASSIFICATION_METRICS = [
  { re: /f1_score|f1\b|fbeta/i,             name: 'F1' },
  { re: /precision_score|\bprecision\b/i,   name: 'precision' },
  { re: /recall_score|\brecall\b/i,         name: 'recall' },
  { re: /roc_auc_score|roc_auc|auc\b/i,     name: 'ROC-AUC' },
  { re: /average_precision|ap_score/i,      name: 'avg precision' },
  { re: /matthews_corrcoef|mcc\b/i,         name: 'MCC' },
];

const REGRESSION_METRICS = [
  { re: /mean_squared_error|rmse|mse\b/i,   name: 'RMSE/MSE' },
  { re: /mean_absolute_error|\bmae\b/i,     name: 'MAE' },
  { re: /r2_score|\br2\b|\br_squared\b/i,   name: 'R²' },
  { re: /mean_absolute_percentage_error|mape\b/i, name: 'MAPE' },
];

export async function run({ dir }) {
  const specPath = join(dir, 'evaluation-spec.json');
  let task = null;
  if (existsSync(specPath)) {
    try { task = JSON.parse(readFileSync(specPath, 'utf8'))?.task?.toLowerCase(); } catch {}
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!pyFiles.length) return { pass: false, code: 'ME004', message: 'No Python files found' };

  let content = '';
  for (const f of pyFiles) {
    const raw = readFileSync(join(dir, f), 'utf8');
    if (f.endsWith('.ipynb')) {
      try { content += (JSON.parse(raw).cells || []).map(c => (c.source || []).join('')).join('\n'); }
      catch { content += raw; }
    } else {
      content += raw;
    }
  }

  if (/@single-metric-ok/.test(content)) {
    return { pass: true, code: 'ME004', message: 'Single-metric evaluation explicitly acknowledged via @single-metric-ok' };
  }

  const isClassification = task === 'classification' || /classification|LogisticRegression|RandomForestClassifier|XGBClassif/i.test(content);
  const isRegression     = task === 'regression'     || /regression|LinearRegression|Ridge|Lasso|XGBRegress/i.test(content);

  if (isClassification) {
    const found = CLASSIFICATION_METRICS.filter(m => m.re.test(content));
    if (found.length < 2) {
      const missing = CLASSIFICATION_METRICS.filter(m => !m.re.test(content)).slice(0, 3).map(m => m.name);
      return {
        pass: false, code: 'ME004',
        message: `Classification evaluation: only ${found.map(m => m.name).join(', ') || 'none'} — needs F1 + precision + recall`,
        detail: `Missing metrics: ${missing.join(', ')}\n` +
                'from sklearn.metrics import classification_report\n' +
                'print(classification_report(y_test, y_pred))  # prints all three\n' +
                'Add # @single-metric-ok: <reason> if only one metric is needed.',
      };
    }
    return { pass: true, code: 'ME004', message: `Classification metrics: ${found.map(m => m.name).join(', ')}` };
  }

  if (isRegression) {
    const found = REGRESSION_METRICS.filter(m => m.re.test(content));
    if (found.length < 2) {
      return {
        pass: false, code: 'ME004',
        message: `Regression evaluation: only ${found.map(m => m.name).join(', ') || 'none'} — needs RMSE + MAE + R²`,
        detail: 'from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score\n' +
                'rmse = mean_squared_error(y_test, y_pred, squared=False)\n' +
                'mae  = mean_absolute_error(y_test, y_pred)\n' +
                'r2   = r2_score(y_test, y_pred)',
      };
    }
    return { pass: true, code: 'ME004', message: `Regression metrics: ${found.map(m => m.name).join(', ')}` };
  }

  // Unknown task — require at least 2 of any metrics
  const allMetrics = [...CLASSIFICATION_METRICS, ...REGRESSION_METRICS].filter(m => m.re.test(content));
  if (allMetrics.length < 2) {
    return {
      pass: false, code: 'ME004',
      message: `Only ${allMetrics.length} metric(s) detected — evaluation needs at least 2 complementary metrics`,
      detail: 'Set "task" in evaluation-spec.json for task-specific guidance.\n' +
              'Add # @single-metric-ok: <reason> if one metric is genuinely sufficient.',
    };
  }
  return { pass: true, code: 'ME004', message: `${allMetrics.length} evaluation metrics detected` };
}
