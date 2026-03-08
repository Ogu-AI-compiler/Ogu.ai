/**
 * Gate UOF003 — skip-option
 * Every step with required:false must declare:
 * - skipLabel (string)
 * - skipTarget (string — next step id or terminationTarget)
 * If all steps are required, this gate is not applicable.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'onboarding-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UOF003',
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
      code: 'UOF003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.steps)) {
    return {
      pass: true,
      code: 'UOF003',
      message: 'No steps array — skipped',
      skipped: true,
    };
  }

  const optionalSteps = spec.steps.filter(s => s.required === false);

  if (optionalSteps.length === 0) {
    return {
      pass: true,
      code: 'UOF003',
      message: 'skip-option: all steps are required — skip option gate not applicable',
    };
  }

  const violations = [];
  optionalSteps.forEach(step => {
    const id = step.id || 'unknown';
    if (typeof step.skipLabel !== 'string' || step.skipLabel.trim() === '') {
      violations.push(`step "${id}" (required:false) missing skipLabel (string)`);
    }
    if (typeof step.skipTarget !== 'string' || step.skipTarget.trim() === '') {
      violations.push(`step "${id}" (required:false) missing skipTarget (string)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UOF003',
      message: `${violations.length} optional step(s) missing skipLabel or skipTarget`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UOF003',
    message: `skip-option: all ${optionalSteps.length} optional step(s) have skipLabel and skipTarget`,
  };
}
