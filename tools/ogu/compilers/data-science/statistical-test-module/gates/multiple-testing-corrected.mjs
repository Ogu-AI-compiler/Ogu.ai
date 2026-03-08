/**
 * Why:
 * When multiple statistical tests are run on the same dataset, the family-wise
 * error rate (FWER) inflates. Running 20 tests at α=0.05 gives a ~64% chance
 * of at least one false positive — even if no true effects exist.
 *
 * This is one of the primary causes of irreproducible research: researchers
 * run many tests, report the significant ones, and the "findings" don't
 * replicate because they were false positives.
 *
 * Correction methods:
 * - Bonferroni: α_corrected = α / n_tests (conservative, controls FWER)
 * - Benjamini-Hochberg (FDR): controls false discovery rate, less conservative
 * - statsmodels multipletests(): implements both and others
 * - Šidák correction, Holm, etc.
 *
 * This gate triggers when ≥2 distinct hypothesis test calls are detected and
 * no correction method is present.
 *
 * Escape hatch: add `# @no-correction-ok: <reason>` if tests are genuinely
 * independent and correction is not required (e.g., pre-registered, Bayesian).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TEST_CALLS = [
  /ttest_ind\s*\(/,
  /ttest_rel\s*\(/,
  /mannwhitneyu\s*\(/,
  /wilcoxon\s*\(/,
  /chi2_contingency\s*\(/,
  /fisher_exact\s*\(/,
  /kruskal\s*\(/,
  /f_oneway\s*\(/,
  /ks_2samp\s*\(/,
  /ranksums\s*\(/,
];

const CORRECTION_RE = /bonferroni|multipletests|p_adjust|fdr_bh|fdrcorrection|holm|sidak|padjust/i;

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
  if (!pyFiles.length) return { pass: true, code: 'ST008', message: 'No Python files — skipped', skipped: true };

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

  if (/@no-correction-ok/.test(content)) {
    return { pass: true, code: 'ST008', message: 'Multiple testing correction explicitly waived via @no-correction-ok' };
  }

  const testCount = TEST_CALLS.filter(re => re.test(content)).length;
  if (testCount < 2) {
    return { pass: true, code: 'ST008', message: `Only ${testCount} test type(s) detected — correction not required` };
  }

  if (!CORRECTION_RE.test(content)) {
    return {
      pass: false, code: 'ST008',
      message: `${testCount} different test types detected without multiple-testing correction`,
      detail: 'Running multiple tests inflates false positive rate. Apply correction:\n' +
              '  from statsmodels.stats.multitest import multipletests\n' +
              '  reject, p_corrected, _, _ = multipletests(p_values, alpha=0.05, method="fdr_bh")\n\n' +
              'Methods: "bonferroni" (conservative), "fdr_bh" (Benjamini-Hochberg), "holm"\n' +
              'Add # @no-correction-ok: <reason> if correction is genuinely not needed.',
    };
  }

  return { pass: true, code: 'ST008', message: `Multiple testing correction present for ${testCount} test types` };
}
