/**
 * Why:
 * A p-value reported without effect size or confidence interval is misleading.
 * Statistical significance (p < 0.05) tells you only that an effect is unlikely
 * to be zero — it says nothing about whether the effect is large enough to matter.
 * A study with N=1,000,000 can produce p < 0.001 for a difference of 0.0001%,
 * which is statistically significant but practically meaningless.
 *
 * This gate enforces the APA (American Psychological Association) and ASA
 * (American Statistical Association) guidelines: every p-value must be
 * accompanied by an effect size estimate (Cohen's d, r, η², odds ratio)
 * or a confidence interval that quantifies the magnitude of the effect.
 *
 * Escape hatch: add `# @p-only-ok: <reason>` if a bare p-value is genuinely
 * all that is needed (e.g., a go/no-go gate where magnitude is fixed by design).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PVALUE_RE = /p_value|pvalue|p\.value|\.pvalue\b|\bp\s*<\s*0\.\d+|\bp\s*=\s*0\.\d+/i;
const EFFECT_SIZE_RE = /effect_size|cohen|eta_squared|cramers_v|odds_ratio|risk_ratio|relative_risk|lift\b|mean_diff|hedge/i;
const CI_RE = /confidence_interval|conf_int|\.interval\s*\(|CI_\w|_ci\b|margin_of_error|\±|alpha.*interval/i;

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!pyFiles.length) return { pass: true, code: 'ST007', message: 'No Python files — skipped', skipped: true };

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

  if (/@p-only-ok/.test(content)) {
    return { pass: true, code: 'ST007', message: 'Bare p-value explicitly acknowledged via @p-only-ok' };
  }

  const hasPValue    = PVALUE_RE.test(content);
  const hasEffect    = EFFECT_SIZE_RE.test(content);
  const hasCI        = CI_RE.test(content);

  if (!hasPValue) {
    return { pass: true, code: 'ST007', message: 'No p-value usage detected — skipped', skipped: true };
  }

  if (!hasEffect && !hasCI) {
    return {
      pass: false, code: 'ST007',
      message: 'p-value found without effect size or confidence interval',
      detail: 'p < 0.05 alone is insufficient. Report the magnitude:\n' +
              '  Effect size: cohen_d = (mean_b - mean_a) / pooled_std\n' +
              '  CI: scipy.stats.t.interval(0.95, df=..., loc=diff, scale=se)\n' +
              'This follows APA and ASA guidelines for statistical reporting.\n' +
              'Add # @p-only-ok: <reason> if magnitude is truly not needed.',
    };
  }

  return {
    pass: true, code: 'ST007',
    message: 'p-value reported with ' + [hasEffect && 'effect size', hasCI && 'confidence interval'].filter(Boolean).join(' and '),
  };
}
