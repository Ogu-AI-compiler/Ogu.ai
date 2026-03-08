import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA012 — thresholds-realistic
 * Global threshold values must be between 60% and 100%.
 *
 * Below 60%: indicates either a config error or a project that has given up
 *   on meaningful coverage. This is a warning that the policy is not serious.
 * Above 100%: impossible (caught by thresholds-consistent but double-checked here).
 *
 * Exception: a project explicitly declaring "we are in bootstrap mode" can set
 * spec.bootstrapMode: true to lower the floor to 0 (skips this gate).
 */

const MIN_REALISTIC = 60;
const MAX_REALISTIC = 100;

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'coverage-policy-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA012', message: 'coverage-policy-spec.json not readable' };
  }

  if (spec.bootstrapMode === true) {
    return {
      pass: true, code: 'QA012',
      message: 'bootstrapMode: true — threshold floor waived for initial project setup',
      skipped: true,
    };
  }

  const g = spec.global || {};
  const violations = [];

  for (const [key, val] of Object.entries(g)) {
    if (typeof val !== 'number') continue;
    if (val < MIN_REALISTIC) {
      violations.push(`${key}: ${val}% is below minimum realistic threshold of ${MIN_REALISTIC}%`);
    }
    if (val > MAX_REALISTIC) {
      violations.push(`${key}: ${val}% exceeds 100% — impossible`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA012',
      message: `Threshold realism violations: ${violations.length}`,
      detail: violations.join('\n') + '\n\nIf this is an early-stage project, set spec.bootstrapMode: true to acknowledge the low threshold.',
    };
  }

  return {
    pass: true, code: 'QA012',
    message: `All global thresholds in realistic range [${MIN_REALISTIC}%–${MAX_REALISTIC}%]`,
  };
}
