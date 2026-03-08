import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ME010 — contract-evaluation
 * Verifies that evaluation reports satisfy the contract:
 * multiple metrics, baseline comparison, and test set predictions.
 *
 * Why:
 * - Multiple metrics is the first principle of model evaluation: a single
 *   metric (e.g., accuracy alone) is exploitable — a classifier that always
 *   predicts "majority class" achieves 95% accuracy on imbalanced data.
 * - Baseline comparison without it, there is no reference point: a model
 *   with F1=0.72 could be excellent (baseline: 0.40) or poor (baseline: 0.85).
 *   DummyClassifier/DummyRegressor provides the minimum viable baseline.
 * - Test set predictions: the evaluation must use a held-out test set.
 *   Evaluating on training data reports memorization, not generalization.
 *
 * Escape hatch: none — these are non-negotiable for production model evaluation.
 */

const RULES = [
  {
    id: 'multiple-metrics',
    description: 'Multiple complementary metrics computed (F1 + precision + recall, or RMSE + MAE + R²)',
    test: c => {
      const classif = [/f1_score/, /precision_score|recall_score/, /roc_auc_score/, /average_precision/];
      const regress = [/mean_squared_error|rmse/i, /mean_absolute_error/i, /r2_score/i];
      return classif.filter(p => p.test(c)).length >= 2 || regress.filter(p => p.test(c)).length >= 2;
    },
  },
  {
    id: 'baseline-present',
    description: 'Baseline comparison present (DummyClassifier, DummyRegressor, or explicit baseline)',
    test: c => /DummyClassifier|DummyRegressor|baseline_metric|baseline_score/.test(c),
  },
  {
    id: 'test-set-prediction',
    description: 'Predictions made on test set (predict(X_test))',
    test: c => /predict\s*\(\s*(?:X_test|x_test|test_X|test_features)/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!files.length) return { pass: false, code: 'ME010', message: 'No Python or notebook files found' };

  let content = '';
  for (const f of files) {
    const raw = readFileSync(join(dir, f), 'utf8');
    if (f.endsWith('.ipynb')) {
      try { content += (JSON.parse(raw).cells || []).map(c => (c.source || []).join('')).join('\n'); }
      catch { content += raw; }
    } else {
      content += raw;
    }
  }

  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'ME010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'ME010', message: 'All evaluation contract rules passed' };
}
