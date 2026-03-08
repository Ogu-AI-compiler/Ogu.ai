import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ME003 — baseline-comparison
 * Model evaluation reports must compare against a declared baseline.
 *
 * Why:
 * - "F1=0.78" is meaningless without context. Is that good? Against a random
 *   predictor? Against majority-class prediction? Against the previous model?
 * - A model that achieves 0.78 F1 vs a majority-class baseline of 0.79 F1
 *   is WORSE than doing nothing. Without the baseline, this failure is invisible.
 * - Baselines document the value delivered by ML over simpler approaches.
 *   If a logistic regression achieves 0.76 and your XGBoost achieves 0.77,
 *   the marginal gain may not justify the operational complexity.
 * - Regulatory contexts require demonstration that the model outperforms
 *   existing processes, not just that it's "accurate."
 *
 * Baseline types (any one suffices):
 * - DummyClassifier/DummyRegressor (sklearn)
 * - Random predictor (majority class, mean)
 * - Previous model version (champion model)
 * - Rule-based system metrics declared in spec
 *
 * Escape hatch: add "baselineInSpec": true to eval-spec.json with
 * "baseline_metric" and "baseline_value" for externally computed baselines.
 */

const BASELINE_PATTERNS = [
  /DummyClassifier\s*\(/,
  /DummyRegressor\s*\(/,
  /baseline|random.classifier|majority.class/i,
  /previous.model|champion.model|old.model/i,
  /rule.based|heuristic.baseline/i,
];

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'eval-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'ME003', message: 'eval-spec.json not readable' }; }

  // Spec-declared baseline
  if (spec.baselineInSpec === true) {
    const bv = spec.baseline_value != null ? `${spec.primary_metric}=${spec.baseline_value}` : 'declared';
    return { pass: true, code: 'ME003', message: `Baseline ${bv} declared in spec`, skipped: true };
  }

  if (spec.baseline_metric && spec.baseline_value != null) {
    return {
      pass: true, code: 'ME003',
      message: `Baseline declared in spec: ${spec.baseline_metric}=${spec.baseline_value}`,
    };
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return {
      pass: false, code: 'ME003',
      message: 'No baseline comparison found — add baseline to spec or code',
      detail: 'Declare baseline in eval-spec.json:\n  "baseline_metric": "f1_score",\n  "baseline_value": 0.71\n\nOr compute in code:\n  from sklearn.dummy import DummyClassifier\n  dummy = DummyClassifier(strategy="most_frequent")\n  dummy.fit(X_train, y_train)\n  print(f"Baseline F1: {f1_score(y_test, dummy.predict(X_test)):.4f}")',
    };
  }

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const hasBaseline = BASELINE_PATTERNS.some(p => p.test(content));

  if (!hasBaseline) {
    return {
      pass: false, code: 'ME003',
      message: 'No baseline comparison in evaluation report',
      detail: 'Add a baseline comparison:\n' +
        '  from sklearn.dummy import DummyClassifier\n' +
        '  baseline = DummyClassifier(strategy="most_frequent").fit(X_train, y_train)\n' +
        '  baseline_f1 = f1_score(y_test, baseline.predict(X_test))\n' +
        '  model_f1 = f1_score(y_test, model.predict(X_test))\n' +
        '  print(f"Improvement over baseline: +{model_f1 - baseline_f1:.4f}")',
    };
  }

  return { pass: true, code: 'ME003', message: 'Baseline comparison present in evaluation report' };
}
