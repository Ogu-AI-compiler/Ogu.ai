/**
 * Gate UOF002 — terminates-to-main
 * spec.terminationTarget must be:
 * - A non-empty string
 * - Must NOT point to an onboarding step id (circular reference)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'onboarding-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UOF002',
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
      code: 'UOF002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const target = spec.terminationTarget;

  if (typeof target !== 'string' || target.trim() === '') {
    return {
      pass: false,
      code: 'UOF002',
      message: 'terminationTarget is missing or empty — must point to the main app screen users land on after onboarding',
    };
  }

  if (!Array.isArray(spec.steps)) {
    return {
      pass: true,
      code: 'UOF002',
      message: `terminates-to-main: terminationTarget="${target}" (no steps to check for circular reference)`,
    };
  }

  const stepIds = new Set(spec.steps.map(s => s.id).filter(Boolean));

  if (stepIds.has(target)) {
    return {
      pass: false,
      code: 'UOF002',
      message: `terminationTarget="${target}" points to an onboarding step id — this creates a circular flow. Use a main app route instead.`,
    };
  }

  return {
    pass: true,
    code: 'UOF002',
    message: `terminates-to-main: terminationTarget="${target}" is not circular`,
  };
}
