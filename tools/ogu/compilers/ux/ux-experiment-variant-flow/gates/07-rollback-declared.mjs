/**
 * Gate UEV007 — rollback-declared
 * Spec must declare rollbackBehavior:
 * "revert-to-control" | "disable-experiment" | "gradual-ramp-down"
 * Missing rollback means no defined behavior when the experiment is stopped.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_ROLLBACK_BEHAVIORS = new Set([
  'revert-to-control',
  'disable-experiment',
  'gradual-ramp-down',
]);

export async function run({ dir }) {
  const specPath = join(dir, 'experiment-variant-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UEV007',
      message: 'experiment-variant-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UEV007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (typeof spec.rollbackBehavior !== 'string') {
    return {
      pass: false,
      code: 'UEV007',
      message: 'rollbackBehavior is missing — must be "revert-to-control", "disable-experiment", or "gradual-ramp-down"',
    };
  }

  if (!VALID_ROLLBACK_BEHAVIORS.has(spec.rollbackBehavior)) {
    return {
      pass: false,
      code: 'UEV007',
      message: `rollbackBehavior="${spec.rollbackBehavior}" is invalid — must be "revert-to-control", "disable-experiment", or "gradual-ramp-down"`,
    };
  }

  return {
    pass: true,
    code: 'UEV007',
    message: `rollback-declared: rollbackBehavior="${spec.rollbackBehavior}"`,
  };
}
