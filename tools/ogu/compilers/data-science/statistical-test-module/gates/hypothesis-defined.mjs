import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ST001 — hypothesis-defined
 * Statistical tests must have explicit null and alternative hypotheses
 * documented before the test is run.
 *
 * Why:
 * - Running a statistical test without a pre-specified hypothesis is
 *   HARKing (Hypothesizing After Results are Known) — a form of p-hacking.
 * - When hypotheses are formed after seeing the data, p-values lose their
 *   meaning: you've effectively run an unlimited number of tests and reported
 *   only the ones that "worked."
 * - Documented hypotheses force researchers to commit to a direction
 *   (one-tailed vs two-tailed) before seeing results, which determines
 *   the appropriate test and prevents post-hoc direction changes.
 * - Peer review, regulatory review, and business decision-makers expect
 *   to see H₀ and H₁ for any claim supported by statistical evidence.
 *
 * Required: explicit H0 (null hypothesis) and H1/Ha (alternative hypothesis)
 * as Python strings or markdown cells, before any scipy.stats or test calls.
 *
 * Escape hatch: add "hypothesisInDocs": true to stat-test-spec.json if
 * hypotheses are documented in an external protocol document.
 */

const H0_PATTERN = /\b(?:H0|H_0|null.hyp|null_hyp|hypothesis.*null|no.significant.diff)/i;
const H1_PATTERN = /\b(?:H1|Ha|H_1|H_a|alt.hyp|alt_hyp|alternative.hyp|significant.diff|effect.exists)/i;

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
  catch { return { pass: false, code: 'ST001', message: 'stat-test-spec.json not readable' }; }

  if (spec.hypothesisInDocs === true) {
    return { pass: true, code: 'ST001', message: 'hypothesisInDocs: true — hypotheses in external protocol', skipped: true };
  }

  // Check if hypotheses are in the spec itself
  if (spec.null_hypothesis && spec.alternative_hypothesis) {
    return {
      pass: true, code: 'ST001',
      message: `H₀ and H₁ declared in spec: "${String(spec.null_hypothesis).slice(0, 50)}"`,
    };
  }

  const content = extractAllText(dir);
  if (!content.trim()) {
    return { pass: false, code: 'ST001', message: 'No analysis files found' };
  }

  const hasH0 = H0_PATTERN.test(content);
  const hasH1 = H1_PATTERN.test(content);

  if (!hasH0 && !hasH1) {
    return {
      pass: false, code: 'ST001',
      message: 'No hypothesis statements found (H₀ and H₁)',
      detail: 'Document hypotheses before running any test:\n\n' +
        '  H0 = "There is no difference in conversion rate between control and treatment"\n' +
        '  Ha = "Treatment has a higher conversion rate than control (one-tailed)"\n\n' +
        'Or add to stat-test-spec.json:\n' +
        '  "null_hypothesis": "No difference in conversion rate",\n' +
        '  "alternative_hypothesis": "Treatment conversion rate > control"',
    };
  }

  if (!hasH0) {
    return {
      pass: false, code: 'ST001',
      message: 'Alternative hypothesis (H₁) found but no null hypothesis (H₀)',
      detail: 'Add: H0 = "There is no significant difference between groups"',
    };
  }

  if (!hasH1) {
    return {
      pass: false, code: 'ST001',
      message: 'Null hypothesis (H₀) found but no alternative hypothesis (H₁/Ha)',
      detail: 'Add: Ha = "Group A has significantly higher metric than Group B"',
    };
  }

  return { pass: true, code: 'ST001', message: 'Null and alternative hypotheses documented' };
}
