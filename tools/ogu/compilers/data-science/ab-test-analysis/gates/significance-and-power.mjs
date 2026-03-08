/**
 * Why:
 * A rigorous A/B test report must include four statistical components:
 *
 * 1. STATISTICAL SIGNIFICANCE (p-value): Is the observed difference likely
 *    real or due to chance? Threshold defined by α in spec (typically 0.05).
 *
 * 2. EFFECT SIZE: How large is the difference that matters? p < 0.05 with
 *    N=10M can detect a 0.001% lift — statistically significant but not
 *    worth shipping. Common measures: Cohen's d, relative lift, odds ratio.
 *
 * 3. STATISTICAL POWER (1-β): What is the probability we would have detected
 *    a real effect of the minimum detectable size? Power < 0.80 means we
 *    may be accepting the null hypothesis despite a real effect existing.
 *    (Type II error). This is especially critical for "no significant difference"
 *    conclusions — without power, a null result is inconclusive.
 *
 * 4. CONFIDENCE INTERVAL: Range of plausible true effect sizes. A CI that
 *    excludes zero at the 95% level is equivalent to p < 0.05, but also
 *    communicates practical significance (a 1% lift CI vs a 30% lift CI
 *    both exclude zero but have very different implications).
 *
 * Escape hatch: add `# @partial-stats-ok: <component>` for each component
 * that is intentionally omitted (e.g., `# @partial-stats-ok: power` if the
 * experiment was pre-registered and power was computed at design time).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function readContent(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  let out = '';
  for (const f of files) {
    const raw = readFileSync(join(dir, f), 'utf8');
    if (f.endsWith('.ipynb')) {
      try { out += (JSON.parse(raw).cells || []).map(c => (c.source || []).join('')).join('\n'); }
      catch { out += raw; }
    } else {
      out += raw;
    }
  }
  return out;
}

const COMPONENTS = [
  {
    name: 'significance test (p-value)',
    key: 'significance',
    re: /ttest_ind|mannwhitneyu|chi2_contingency|proportions_ztest|ztest\b|scipy\.stats\.\w+test/i,
    hint: 'from scipy import stats\nt_stat, p_value = stats.ttest_ind(control, treatment)',
  },
  {
    name: 'effect size',
    key: 'effect_size',
    re: /effect_size|cohen|lift\b|relative.*change|mean_diff|odds_ratio|risk_ratio/i,
    hint: 'cohen_d = (treatment.mean() - control.mean()) / pooled_std\nrelative_lift = (treatment.mean() - control.mean()) / control.mean()',
  },
  {
    name: 'statistical power',
    key: 'power',
    re: /\bpower\b|TTestIndPower|NormalIndPower|solve_power|statsmodels\.stats\.power/i,
    hint: 'from statsmodels.stats.power import TTestIndPower\npower = TTestIndPower().power(effect_size=cohen_d, nobs1=n, alpha=0.05)',
  },
  {
    name: 'confidence interval',
    key: 'ci',
    re: /confidence_interval|conf_int|\.interval\s*\(|CI_\w|_ci\b|\±|margin_of_error/i,
    hint: 'ci = stats.t.interval(0.95, df=n_a+n_b-2, loc=mean_diff, scale=se)',
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!files.length) return { pass: false, code: 'AB007', message: 'No Python files found' };

  const content = readContent(dir);
  const violations = [];

  for (const comp of COMPONENTS) {
    const escaped = new RegExp(`@partial-stats-ok:\\s*${comp.key}`).test(content);
    if (escaped) continue;
    if (!comp.re.test(content)) {
      violations.push({ name: comp.name, hint: comp.hint });
    }
  }

  if (violations.length) {
    const detail = violations.map(v =>
      `Missing: ${v.name}\n  ${v.hint}`
    ).join('\n\n');

    return {
      pass: false, code: 'AB007',
      message: `${violations.length} statistical component(s) missing from A/B test report`,
      detail: detail + '\n\nAdd # @partial-stats-ok: <key> to suppress specific components.',
    };
  }

  return { pass: true, code: 'AB007', message: 'All 4 statistical components present: significance + effect size + power + CI' };
}
