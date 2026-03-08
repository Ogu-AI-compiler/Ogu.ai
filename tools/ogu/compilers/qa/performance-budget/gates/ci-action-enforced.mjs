import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA034 — ci-action-enforced
 * ciAction must not be "none". A performance budget that has no CI consequence
 * is aspirational documentation — it does not prevent regressions.
 *
 * Valid: "fail" (build fails), "warn" (PR comment, build passes)
 * "fail" is strongly preferred for LCP and CLS.
 * "warn" is acceptable for Lighthouse scores (high variance between runs).
 * "none" is forbidden.
 */

const VALID_ACTIONS = new Set(['fail', 'warn', 'block']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'performance-budget-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA034', message: 'performance-budget-spec.json not readable' }; }

  const action = spec.ciAction;

  if (!action || action === 'none' || action === false) {
    return {
      pass: false, code: 'QA034',
      message: `ciAction is "${action}" — performance budget is defined but never enforced`,
      detail: 'Set ciAction to "fail" (build fails on budget violation) or "warn" (PR comment). A budget that does nothing is just documentation.',
    };
  }

  if (!VALID_ACTIONS.has(action)) {
    return {
      pass: false, code: 'QA034',
      message: `ciAction "${action}" not recognised — must be one of: ${[...VALID_ACTIONS].join(', ')}`,
    };
  }

  return { pass: true, code: 'QA034', message: `ciAction: "${action}" — budget violations are enforced` };
}
