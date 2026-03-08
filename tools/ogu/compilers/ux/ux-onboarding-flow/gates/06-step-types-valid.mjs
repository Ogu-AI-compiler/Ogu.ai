/**
 * Gate UOF006 — step-types-valid
 * Every step.type must be one of:
 * "info" | "setup" | "permission-prompt" | "tutorial" | "verification" | "celebration"
 * Invalid types create undefined rendering behavior.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_STEP_TYPES = new Set([
  'info',
  'setup',
  'permission-prompt',
  'tutorial',
  'verification',
  'celebration',
]);

export async function run({ dir }) {
  const specPath = join(dir, 'onboarding-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UOF006',
      message: 'onboarding-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UOF006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return {
      pass: true,
      code: 'UOF006',
      message: 'No steps to validate — skipped',
      skipped: true,
    };
  }

  const violations = [];
  spec.steps.forEach((step, i) => {
    const id = step.id || `steps[${i}]`;
    if (typeof step.type !== 'string') {
      violations.push(`${id}: type is not a string`);
    } else if (!VALID_STEP_TYPES.has(step.type)) {
      violations.push(
        `${id}: invalid type "${step.type}" — must be one of: ${[...VALID_STEP_TYPES].join(', ')}`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UOF006',
      message: `${violations.length} step(s) have invalid type`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UOF006',
    message: `step-types-valid: all ${spec.steps.length} step(s) have valid types`,
  };
}
