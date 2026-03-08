import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ST010 — contract-statistical-test
 * Verifies that statistical test modules satisfy the contract:
 * effect size reported, confidence interval computed, alpha level set.
 *
 * Why:
 * - Effect size without p-value is meaningless; p-value without effect size
 *   is worse. Together they answer: "is the difference real?" (p-value) and
 *   "is the difference large enough to matter?" (effect size). The contract
 *   requires both to be present for any statistical test module.
 * - Confidence intervals are required by the APA (American Psychological
 *   Association) and ASA (American Statistical Association) guidelines for
 *   statistical reporting. A point estimate without uncertainty bounds is
 *   not a complete result.
 * - Alpha must be explicitly set (not defaulted) so that the significance
 *   threshold is documented and the test outcome can be reproduced with
 *   the same decision criterion.
 *
 * Escape hatch: none — these are non-negotiable for production statistical tests.
 */

const RULES = [
  {
    id: 'effect-size',
    description: "Effect size reported (Cohen's d, η², Cramér's V, odds ratio, etc.)",
    test: c => /effect_size|cohen|eta_squared|cramers_v|odds_ratio|risk_ratio|hedges/.test(c),
  },
  {
    id: 'confidence-intervals',
    description: '95% CI computed (bootstrap, scipy.stats.interval, or explicit CI function)',
    test: c => /confidence_interval|conf_int\b|\.interval\s*\(|CI_\w|bootstrap/.test(c),
  },
  {
    id: 'alpha-set',
    description: 'Significance level α explicitly set in code',
    test: c => /alpha\s*=\s*0\.\d+/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!files.length) return { pass: false, code: 'ST010', message: 'No Python or notebook files found' };

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
      pass: false, code: 'ST010',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'ST010', message: 'All statistical test contract rules passed' };
}
