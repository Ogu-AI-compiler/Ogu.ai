import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ST006 — confidence-intervals
 * Statistical analyses must report confidence intervals alongside point estimates.
 *
 * Why:
 * - A point estimate (mean=0.65) without a confidence interval (0.61–0.69)
 *   conveys false precision. The interval reveals how much uncertainty exists.
 * - Confidence intervals communicate practical significance more clearly
 *   than p-values: "conversion rate increased by 2.1% (95% CI: 0.8%–3.4%)"
 *   is actionable. "p=0.003" is not.
 * - Decision-makers need the full uncertainty range:
 *   - Lower bound of CI below business threshold → might not be worth implementing
 *   - Upper bound of CI above competitor baseline → clearly worth investigating
 * - CIs are required for meta-analysis and systematic reviews.
 *   Results without CIs cannot be combined with other studies.
 *
 * Escape hatch: # @no-ci-ok: <reason> for preliminary exploratory analysis
 * or bootstrap-heavy contexts where CIs are computationally expensive to add.
 */

const CI_PATTERNS = [
  /confidence.?interval/i,
  /\.interval\s*\(\s*(?:alpha|confidence|0\.\d+)/,
  /scipy\.stats\.\w+\.interval/,
  /bootstrap.*ci|ci.*bootstrap/i,
  /lower.?ci|upper.?ci|ci.?lower|ci.?upper/i,
  /margin.?of.?error/i,
  /t\.ppf|norm\.ppf|chi2\.ppf/,
  /sem\s*\(|standard.?error/i,
  /wilson.?interval|clopper.?pearson/i,
  /statsmodels.*confint/,
];

function extractAllText(dir) {
  const parts = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) parts.push((cell.source ?? []).join(''));
      } catch { /* skip */ }
    } else if (file.endsWith('.py') || file.endsWith('.md')) {
      parts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'stat-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'ST006', message: 'stat-test-spec.json not readable' }; }

  const content = extractAllText(dir);
  if (!content.trim()) {
    return { pass: true, code: 'ST006', message: 'No analysis files — CI check skipped', skipped: true };
  }

  if (/@no-ci-ok/.test(content)) {
    return { pass: true, code: 'ST006', message: '@no-ci-ok — confidence intervals omitted intentionally', skipped: true };
  }

  const hasCI = CI_PATTERNS.some(p => p.test(content));
  if (!hasCI) {
    return {
      pass: false, code: 'ST006',
      message: 'No confidence intervals reported in statistical analysis',
      detail: 'Add confidence intervals:\n\n' +
        '  # For a proportion (e.g., conversion rate)\n' +
        '  from scipy.stats import norm\n' +
        '  rate = successes / n\n' +
        '  margin = norm.ppf(0.975) * np.sqrt(rate * (1-rate) / n)\n' +
        '  print(f"Rate: {rate:.3f} (95% CI: {rate-margin:.3f}–{rate+margin:.3f})")\n\n' +
        '  # For a mean comparison\n' +
        '  from scipy.stats import t\n' +
        '  ci = t.interval(0.95, df=len(sample)-1, loc=mean, scale=sem)\n\n' +
        '  # Bootstrap CI (non-parametric)\n' +
        '  from scipy.stats import bootstrap\n' +
        '  res = bootstrap((sample,), np.mean, confidence_level=0.95)\n' +
        '  print(res.confidence_interval)',
    };
  }

  return { pass: true, code: 'ST006', message: 'Confidence intervals reported in statistical analysis' };
}
