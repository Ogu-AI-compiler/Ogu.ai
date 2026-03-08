import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA032 — cls-is-decimal
 * CLS (Cumulative Layout Shift) is a unitless score between 0 and ~0.5.
 * Good: ≤ 0.1. Needs improvement: 0.1–0.25. Poor: > 0.25.
 *
 * A common mistake is confusing CLS with a millisecond value and setting
 * thresholds like CLS: 1, CLS: 100, CLS: 200. These are effectively
 * meaningless (CLS can almost never exceed 1 in practice) and indicate
 * the spec author misunderstood the metric.
 *
 * Rule: CLS.good must be < 1.0 (preferably < 0.5).
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'performance-budget-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA032', message: 'performance-budget-spec.json not readable' }; }

  const cls = spec.coreWebVitals?.CLS;
  if (!cls) {
    return { pass: true, code: 'QA032', message: 'CLS not declared — skipped', skipped: true };
  }

  const goodVal = cls.good;
  const niVal = cls.needsImprovement;

  if (typeof goodVal !== 'number') {
    return { pass: false, code: 'QA032', message: 'CLS.good is not a number' };
  }

  if (goodVal >= 1) {
    return {
      pass: false, code: 'QA032',
      message: `CLS.good is ${goodVal} — CLS is a unitless decimal score (0–0.25), not milliseconds`,
      detail: `CLS measures layout stability. Good: ≤ 0.1. Set:\n  "CLS": { "good": 0.1, "needsImprovement": 0.25 }`,
    };
  }

  if (typeof niVal === 'number' && niVal >= 1) {
    return {
      pass: false, code: 'QA032',
      message: `CLS.needsImprovement is ${niVal} — must also be a decimal (e.g. 0.25)`,
    };
  }

  if (goodVal > 0.25) {
    return {
      pass: false, code: 'QA032',
      message: `CLS.good is ${goodVal} — exceeds Google's "Needs Improvement" threshold of 0.25`,
      detail: `A CLS.good threshold > 0.25 means your "good" category contains poor-rated pages. Use ≤ 0.1 for good, ≤ 0.25 for needs improvement.`,
    };
  }

  return { pass: true, code: 'QA032', message: `CLS.good: ${goodVal} — valid decimal score` };
}
