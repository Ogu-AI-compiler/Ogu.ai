import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA072 — fail-on-critical
 * The CI pipeline must fail on critical (impact: "critical") accessibility violations.
 *
 * Axe-core and similar tools classify violations by impact:
 *   critical  — serious accessibility barrier, prevents usage entirely
 *   serious   — significant problem, very difficult to use
 *   moderate  — meaningful problem, confusing or degraded experience
 *   minor     — visual/cosmetic issue
 *
 * Critical violations are not debatable — screen readers cannot navigate the page,
 * keyboard users are trapped in a focus loop, or content is completely inaccessible.
 * These must block deployment.
 *
 * Required: spec.ciEnforcement.failOn includes "critical"
 * Recommended: also includes "serious"
 *
 * Accepted shapes for failOn:
 *   - string: "critical"
 *   - array: ["critical", "serious"]
 *   - object with impact levels: { critical: true, serious: false }
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'accessibility-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA072', message: 'accessibility-policy-spec.json not readable' }; }

  const enforcement = spec.ciEnforcement;
  if (!enforcement) {
    return { pass: false, code: 'QA072', message: 'spec.ciEnforcement not declared' };
  }

  const failOn = enforcement.failOn;
  if (failOn === undefined || failOn === null) {
    return {
      pass: false, code: 'QA072',
      message: 'ciEnforcement.failOn not declared — no accessibility violations will block CI',
      detail: 'Add "failOn": ["critical", "serious"] to enforce accessibility in CI.',
    };
  }

  // Normalize to array
  let impacts;
  if (typeof failOn === 'string') {
    impacts = [failOn];
  } else if (Array.isArray(failOn)) {
    impacts = failOn;
  } else if (typeof failOn === 'object') {
    impacts = Object.entries(failOn).filter(([, v]) => v === true).map(([k]) => k);
  } else {
    return { pass: false, code: 'QA072', message: `ciEnforcement.failOn has unexpected type: ${typeof failOn}` };
  }

  if (impacts.length === 0) {
    return {
      pass: false, code: 'QA072',
      message: 'ciEnforcement.failOn is empty — no violations will block CI',
    };
  }

  if (!impacts.includes('critical')) {
    return {
      pass: false, code: 'QA072',
      message: `ciEnforcement.failOn does not include "critical" — got: [${impacts.join(', ')}]`,
      detail: 'Critical violations are absolute accessibility barriers. They must block CI.\nAdd "critical" to failOn.',
    };
  }

  const alsoSerious = impacts.includes('serious');
  const notice = !alsoSerious ? ' (consider also adding "serious")' : '';
  return {
    pass: true, code: 'QA072',
    message: `CI fails on: [${impacts.join(', ')}]${notice}`,
  };
}
