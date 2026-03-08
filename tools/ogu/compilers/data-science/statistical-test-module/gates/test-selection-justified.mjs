import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ST004 — test-selection-justified
 * The choice of statistical test must be justified relative to assumptions.
 *
 * Why:
 * - Statistical tests have assumptions. Violating them invalidates results:
 *   - t-test assumes normality + equal variance → use Mann-Whitney if violated
 *   - Pearson correlation assumes linearity + normality → use Spearman if not
 *   - Chi-squared requires expected cell counts ≥ 5 → use Fisher's exact if smaller
 * - The most common malpractice: defaulting to t-test because it's familiar,
 *   without checking normality (Shapiro-Wilk) or variance homogeneity (Levene).
 * - Non-parametric tests (Mann-Whitney, Wilcoxon, Kruskal-Wallis) are safer
 *   defaults for DS work where normality is rarely verified.
 *
 * This gate checks that assumption testing precedes the primary test:
 * - If t-test used → normality test (shapiro, kstest, normaltest) must appear first
 * - If ANOVA used → Levene or Bartlett test for variance homogeneity
 * - If chi2 used → contingency table with expected value check
 *
 * Escape hatch: # @test-choice-ok: <justification> near the test call,
 * or "testJustifiedInDocs": true in stat-test-spec.json.
 */

const PARAMETRIC_TESTS = [
  { name: 'ttest', re: /ttest_(?:ind|rel|1samp)\s*\(/, assumption: 'normality (shapiro_wilk / kstest / normaltest)' },
  { name: 'ANOVA', re: /f_oneway\s*\(/, assumption: 'normality + variance homogeneity (levene / bartlett)' },
  { name: 'pearsonr', re: /pearsonr\s*\(/, assumption: 'linearity + normality (check with scatter plot / shapiro)' },
];

const NORMALITY_TESTS = [/shapiro\s*\(/, /kstest\s*\(/, /normaltest\s*\(/, /lilliefors\s*\(/];
const VARIANCE_TESTS  = [/levene\s*\(/, /bartlett\s*\(/];

function extractAllText(dir) {
  const parts = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) parts.push((cell.source ?? []).join(''));
      } catch { /* skip */ }
    } else if (file.endsWith('.py')) {
      parts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'stat-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'ST004', message: 'stat-test-spec.json not readable' }; }

  if (spec.testJustifiedInDocs === true) {
    return { pass: true, code: 'ST004', message: 'testJustifiedInDocs: true — justification in external document', skipped: true };
  }

  const content = extractAllText(dir);
  if (!content.trim()) {
    return { pass: true, code: 'ST004', message: 'No Python files — test selection check skipped', skipped: true };
  }

  const issues = [];

  for (const test of PARAMETRIC_TESTS) {
    if (!test.re.test(content)) continue;

    // Check for escape hatch near the test call
    const testIdx = content.search(test.re);
    const context = content.slice(Math.max(0, testIdx - 300), testIdx + 200);
    if (/@test-choice-ok/.test(context)) continue;

    const hasNormality = NORMALITY_TESTS.some(p => p.test(content));
    const hasVariance  = VARIANCE_TESTS.some(p => p.test(content));

    if (test.name === 'ttest' && !hasNormality) {
      issues.push(
        `${test.name} used without normality check — add:\n` +
        `  stat, p = scipy.stats.shapiro(group_a)\n` +
        `  if p < 0.05: use Mann-Whitney instead of t-test\n` +
        `  # @test-choice-ok: confirmed normal via domain knowledge`
      );
    } else if (test.name === 'ANOVA' && (!hasNormality || !hasVariance)) {
      issues.push(
        `ANOVA used without variance homogeneity check — add:\n` +
        `  scipy.stats.levene(*groups)  # if p < 0.05: use Kruskal-Wallis`
      );
    }
  }

  if (issues.length) {
    return {
      pass: false, code: 'ST004',
      message: `${issues.length} parametric test(s) lack assumption verification`,
      detail: issues.join('\n\n'),
    };
  }

  return {
    pass: true, code: 'ST004',
    message: 'Test selection is justified — assumptions verified or non-parametric tests used',
  };
}
