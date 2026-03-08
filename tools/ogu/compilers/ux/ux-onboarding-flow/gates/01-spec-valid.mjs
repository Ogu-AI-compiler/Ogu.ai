/**
 * Gate UOF001 — spec-valid
 * onboarding-spec.json must exist with:
 * - flow_id (string)
 * - steps (array) — each with id, title, type
 * - terminationTarget (string — main app screen/route after onboarding)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'onboarding-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UOF001',
      message: 'onboarding-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UOF001',
      message: `onboarding-spec.json parse error: ${err.message}`,
    };
  }

  const violations = [];

  if (typeof spec.flow_id !== 'string' || spec.flow_id.trim() === '') {
    violations.push('flow_id (string) is missing or empty');
  }
  if (!Array.isArray(spec.steps)) {
    violations.push('steps (array) is missing');
  }
  if (typeof spec.terminationTarget !== 'string' || spec.terminationTarget.trim() === '') {
    violations.push('terminationTarget (string) is missing or empty');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UOF001',
      message: `onboarding-spec.json missing required top-level fields: ${violations.join(', ')}`,
    };
  }

  if (spec.steps.length === 0) {
    return {
      pass: false,
      code: 'UOF001',
      message: 'steps array is empty — an onboarding flow must have at least one step',
    };
  }

  const stepViolations = [];
  spec.steps.forEach((step, i) => {
    if (typeof step.id !== 'string' || step.id.trim() === '') {
      stepViolations.push(`steps[${i}] missing id (string)`);
    }
    if (typeof step.title !== 'string' || step.title.trim() === '') {
      stepViolations.push(`steps[${i}] missing title (string)`);
    }
    if (typeof step.type !== 'string' || step.type.trim() === '') {
      stepViolations.push(`steps[${i}] missing type (string)`);
    }
  });

  if (stepViolations.length > 0) {
    return {
      pass: false,
      code: 'UOF001',
      message: `${stepViolations.length} step(s) missing required fields`,
      detail: stepViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UOF001',
    message: `spec-valid: flow_id="${spec.flow_id}", ${spec.steps.length} step(s), terminationTarget="${spec.terminationTarget}"`,
  };
}
