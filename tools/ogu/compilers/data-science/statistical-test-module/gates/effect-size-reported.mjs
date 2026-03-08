import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ST005 — effect-size-reported
 * Statistical tests must report effect size alongside p-values.
 *
 * Why:
 * - Effect size answers "how big is the difference?" while p-value answers
 *   "how confident are we that the difference is non-zero?"
 * - With large N, trivially small effects become statistically significant.
 *   A study with N=100,000 can get p=0.001 for a 0.001% conversion rate
 *   difference — statistically significant but practically worthless.
 * - Common effect size measures:
 *   - Cohen's d: for comparing means (d=0.2 small, 0.5 medium, 0.8 large)
 *   - Cramér's V: for chi-squared tests on categorical data
 *   - r (correlation): Pearson/Spearman for continuous relationships
 *   - Eta squared (η²): for ANOVA (proportion of variance explained)
 *   - Odds ratio: for binary outcomes in A/B tests
 * - The APA Publication Manual (7th ed.) requires effect sizes in all research.
 *   The ASA Statement on p-Values explicitly warns against over-reliance on
 *   p-values without practical significance context.
 *
 * Escape hatch: # @no-effect-size-ok: <reason> for exploratory analysis
 * where effect size calculation is genuinely premature.
 */

const EFFECT_SIZE_PATTERNS = [
  /cohen(?:s|'s|_d|\.d)/i,
  /effect_size/i,
  /cramer(?:s|'s|_v)/i,
  /eta.?squared|eta2/i,
  /odds.?ratio/i,
  /pearsonr\s*\(|spearmanr\s*\(/,    // correlation IS an effect size
  /glass.?delta/i,
  /hedges.?g/i,
  /r\s*=\s*0\.\d+.*(?:effect|correlation)/i,
  /from\s+(?:pingouin|scipy\.stats)\s+import.*(?:cohen|effect)/,
  /pingouin\.\w*effect/,
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
  catch { return { pass: false, code: 'ST005', message: 'stat-test-spec.json not readable' }; }

  const content = extractAllText(dir);
  if (!content.trim()) {
    return { pass: true, code: 'ST005', message: 'No analysis files — effect size check skipped', skipped: true };
  }

  if (/@no-effect-size-ok/.test(content)) {
    return { pass: true, code: 'ST005', message: '@no-effect-size-ok — effect size omitted intentionally', skipped: true };
  }

  // Check if any test calls exist first
  const hasTestCalls = /scipy\.stats\.|ttest_|mannwhitneyu|chi2_contingency|f_oneway/.test(content);
  if (!hasTestCalls) {
    return { pass: true, code: 'ST005', message: 'No statistical tests found — effect size check skipped', skipped: true };
  }

  const hasEffectSize = EFFECT_SIZE_PATTERNS.some(p => p.test(content));
  if (!hasEffectSize) {
    return {
      pass: false, code: 'ST005',
      message: 'Statistical tests present but no effect size reported',
      detail: 'Add effect size calculation:\n\n' +
        '  # For t-test: Cohen\'s d\n' +
        '  def cohen_d(group1, group2):\n' +
        '      n1, n2 = len(group1), len(group2)\n' +
        '      pooled_std = np.sqrt(((n1-1)*group1.std()**2 + (n2-1)*group2.std()**2) / (n1+n2-2))\n' +
        '      return (group1.mean() - group2.mean()) / pooled_std\n' +
        '  d = cohen_d(group_a, group_b)\n' +
        '  # d=0.2 small, d=0.5 medium, d=0.8 large\n\n' +
        '  # Or use pingouin (simpler):\n' +
        '  import pingouin as pg\n' +
        '  pg.ttest(group_a, group_b)  # includes Cohen\'s d automatically',
    };
  }

  return { pass: true, code: 'ST005', message: 'Effect size reported alongside statistical tests' };
}
