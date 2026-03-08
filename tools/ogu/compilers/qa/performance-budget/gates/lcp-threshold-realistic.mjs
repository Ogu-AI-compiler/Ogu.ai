import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA033 — lcp-threshold-realistic
 * LCP.good must be between 500ms and 4000ms.
 *
 * Google defines Good LCP as ≤ 2500ms. Setting it higher than 4000ms
 * means the budget is laxer than Google's "Poor" threshold — pointless.
 * Setting it lower than 500ms is unreachable even on localhost — the
 * budget will always fail and developers will learn to ignore it.
 */

const LCP_MIN = 500;
const LCP_MAX = 4000;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'performance-budget-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA033', message: 'performance-budget-spec.json not readable' }; }

  const lcp = spec.coreWebVitals?.LCP;
  if (!lcp) return { pass: true, code: 'QA033', message: 'LCP not declared — skipped', skipped: true };

  const goodVal = lcp.good;
  if (typeof goodVal !== 'number') return { pass: false, code: 'QA033', message: 'LCP.good is not a number' };

  if (goodVal < LCP_MIN) {
    return {
      pass: false, code: 'QA033',
      message: `LCP.good: ${goodVal}ms is unreachably fast — minimum realistic: ${LCP_MIN}ms`,
      detail: `A threshold below ${LCP_MIN}ms means budget will always fail. Google Good = ≤ 2500ms.`,
    };
  }

  if (goodVal > LCP_MAX) {
    return {
      pass: false, code: 'QA033',
      message: `LCP.good: ${goodVal}ms exceeds max realistic ${LCP_MAX}ms (Google Poor = > 4000ms)`,
      detail: `Setting LCP.good > 4000ms means your "good" budget is laxer than Google's "Poor". Use ≤ 2500ms for good quality.`,
    };
  }

  const rating = goodVal <= 2500 ? 'Google Good' : 'Google Needs Improvement';
  return { pass: true, code: 'QA033', message: `LCP.good: ${goodVal}ms — ${rating} range` };
}
