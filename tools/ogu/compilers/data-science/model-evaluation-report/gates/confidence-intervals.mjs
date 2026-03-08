/**
 * Why:
 * Point estimates of model metrics (e.g., "F1 = 0.82") are insufficient for
 * production decisions. A single test-set evaluation is a sample — the true
 * metric has uncertainty. Without confidence intervals you cannot:
 * - Know whether a 0.82 vs 0.79 difference between models is statistically real
 * - Set a deployment threshold with confidence ("deploy only if F1 > 0.80")
 * - Detect metric instability across different data slices
 *
 * Accepted CI methods:
 * - Bootstrap: resample test set 1000×, compute metric distribution
 * - cross_val_score: std of K-fold scores ≈ standard error
 * - scipy.stats.t.interval / scipy.stats.norm.interval: parametric CI
 * - Wilson interval for proportions (accuracy, precision, recall)
 *
 * Escape hatch: add `# @no-ci-ok: <reason>` if the evaluation is a quick
 * diagnostic and not a production deployment decision.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CI_PATTERNS = [
  { re: /cross_val_score/,                            name: 'cross_val_score' },
  { re: /scipy\.stats\.\w+\.interval/,                name: 'scipy CI interval' },
  { re: /bootstrap|resample.*\d{3,}/i,                name: 'bootstrap' },
  { re: /confidence_interval|conf_int\b/i,            name: 'confidence_interval' },
  { re: /\.std\(\).*metric|metric.*\.std\(\)/i,       name: 'metric std deviation' },
  { re: /wilson.*interval|proportion.*confint/i,      name: 'Wilson interval' },
  { re: /margin_of_error|\±\s*[\d.]+/,               name: 'margin of error' },
];

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!pyFiles.length) return { pass: false, code: 'ME007', message: 'No Python files found' };

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

  if (/@no-ci-ok/.test(content)) {
    return { pass: true, code: 'ME007', message: 'Confidence intervals explicitly waived via @no-ci-ok' };
  }

  const found = CI_PATTERNS.filter(p => p.re.test(content));
  if (found.length === 0) {
    return {
      pass: false, code: 'ME007',
      message: 'No confidence interval computation found',
      detail: 'Add uncertainty quantification around your metrics:\n\n' +
              '  # Bootstrap CI (recommended, model-agnostic):\n' +
              '  scores = []\n' +
              '  for _ in range(1000):\n' +
              '      idx = np.random.choice(len(y_test), len(y_test))\n' +
              '      scores.append(f1_score(y_test[idx], y_pred[idx]))\n' +
              '  ci = (np.percentile(scores, 2.5), np.percentile(scores, 97.5))\n\n' +
              '  # Cross-validation CI (fast alternative):\n' +
              '  scores = cross_val_score(model, X, y, cv=5, scoring="f1_macro")\n' +
              '  print(f"F1: {scores.mean():.3f} ± {scores.std() * 2:.3f}")\n\n' +
              'Add # @no-ci-ok: <reason> if this is a diagnostic evaluation only.',
    };
  }

  return { pass: true, code: 'ME007', message: `Confidence interval method found: ${found.map(p => p.name).join(', ')}` };
}
