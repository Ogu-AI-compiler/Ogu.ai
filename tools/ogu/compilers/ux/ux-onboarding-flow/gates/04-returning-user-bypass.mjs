/**
 * Gate UOF004 — returning-user-bypass
 * Spec must declare returningUserBehavior:
 * "skip-entirely" | "show-summary" | "start-from-incomplete" | "always-show"
 * Missing means undefined behavior for returning users.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_RETURNING_BEHAVIORS = new Set([
  'skip-entirely',
  'show-summary',
  'start-from-incomplete',
  'always-show',
]);

export async function run({ dir }) {
  const specPath = join(dir, 'onboarding-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UOF004',
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
      code: 'UOF004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.returningUserBehavior !== 'string') {
    return {
      pass: false,
      code: 'UOF004',
      message: 'returningUserBehavior is missing — must be "skip-entirely", "show-summary", "start-from-incomplete", or "always-show"',
    };
  }

  if (!VALID_RETURNING_BEHAVIORS.has(spec.returningUserBehavior)) {
    return {
      pass: false,
      code: 'UOF004',
      message: `returningUserBehavior="${spec.returningUserBehavior}" is invalid — must be "skip-entirely", "show-summary", "start-from-incomplete", or "always-show"`,
    };
  }

  return {
    pass: true,
    code: 'UOF004',
    message: `returning-user-bypass: returningUserBehavior="${spec.returningUserBehavior}"`,
  };
}
