import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * ME008 — findings-documented
 * Model evaluation reports must document conclusions and next-step recommendations,
 * not just report raw metrics.
 *
 * Why:
 * - A table of metrics without interpretation is not an evaluation report —
 *   it's a log file. Evaluation reports communicate: what do these numbers
 *   mean? Is this model good enough? What should we do next?
 * - Undocumented evaluations force every reader to re-interpret the numbers
 *   themselves, often reaching different conclusions than the author intended.
 * - Evaluation findings serve as the decision record for model deployment:
 *   "We decided to deploy because F1=0.87 exceeded the 0.85 threshold and
 *   confusion matrix shows acceptable false negative rate for this use case."
 *   Without this record, deployment decisions cannot be audited or challenged.
 * - Next steps in the evaluation report drive the engineering roadmap:
 *   "Model underperforms on class 3 — next: collect more class 3 training data."
 *
 * Escape hatch: add "findingsInDocs": true to eval-spec.json if findings
 * are documented in a separate decision record or experiment tracker.
 */

const FINDINGS_PATTERNS = [
  /(?:^|\n)#+\s*(?:findings?|conclusions?|results?|summary|analysis|insights?)/i,
  /(?:^|\n)#+\s*next\s+steps?/i,
  /(?:model|performance)\s+(?:is|appears|shows|achieves|meets|fails|does not)/i,
  /(?:recommend|suggest|propose|conclusion):/i,
];

const NEXT_STEPS_PATTERNS = [
  /next\s+steps?/i,
  /recommend(?:ation)?s?:/i,
  /future\s+work/i,
  /to\s+improve/i,
];

function extractMarkdownFromNotebook(dir) {
  const parts = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.ipynb')) {
      try {
        const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
        for (const cell of nb.cells ?? []) {
          if (cell.cell_type === 'markdown') parts.push((cell.source ?? []).join(''));
        }
      } catch { /* skip */ }
    } else if (file.endsWith('.md') || file.endsWith('.py')) {
      parts.push(readFileSync(join(dir, file), 'utf8'));
    }
  }
  return parts.join('\n');
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'eval-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'ME008', message: 'eval-spec.json not readable' }; }

  if (spec.findingsInDocs === true) {
    return { pass: true, code: 'ME008', message: 'Findings documented externally (findingsInDocs: true)', skipped: true };
  }

  const content = extractMarkdownFromNotebook(dir);
  if (!content.trim()) {
    return { pass: false, code: 'ME008', message: 'No evaluation files found' };
  }

  const hasFindings  = FINDINGS_PATTERNS.some(p => p.test(content));
  const hasNextSteps = NEXT_STEPS_PATTERNS.some(p => p.test(content));

  if (!hasFindings) {
    return {
      pass: false, code: 'ME008',
      message: 'No evaluation findings or conclusions documented',
      detail: 'Add a findings section to the evaluation report:\n\n' +
        '  ## Findings\n' +
        '  The model achieves F1=0.87 on the test set, exceeding the 0.85 deployment threshold.\n' +
        '  - False negative rate on class 2 (fraud): 8% — acceptable for this use case\n' +
        '  - Model underperforms on new customers (< 30 days) due to sparse history\n\n' +
        '  ## Recommendations\n' +
        '  - Deploy to production with automated monitoring on class 2 recall\n' +
        '  - Next iteration: add tenure-based features to improve new customer predictions',
    };
  }

  if (!hasNextSteps) {
    return {
      pass: false, code: 'ME008',
      message: 'Findings present but no next steps or recommendations documented',
      detail: 'Add a next steps section:\n  ## Next Steps\n  - Deploy if F1 > 0.85 — currently meets threshold\n  - Investigate class 3 false negatives\n  - Add confidence calibration (Platt scaling)',
    };
  }

  return { pass: true, code: 'ME008', message: 'Evaluation findings and next steps documented' };
}
