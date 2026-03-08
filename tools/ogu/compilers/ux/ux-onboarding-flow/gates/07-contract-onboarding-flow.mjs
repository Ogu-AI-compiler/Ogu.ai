/**
 * Gate UOF007 — contract-onboarding-flow
 * Final contract check:
 * - version declared
 * - unique step ids
 * - terminationTarget is not empty
 * - at least one step
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'onboarding-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UOF007',
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
      code: 'UOF007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  const violations = [];

  if (!spec.version) {
    violations.push('Contract: onboarding-spec.json missing field "version"');
  }

  if (typeof spec.terminationTarget !== 'string' || spec.terminationTarget.trim() === '') {
    violations.push('Contract: terminationTarget is missing or empty');
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    violations.push('Contract: steps array is missing or empty — at least one step is required');
  } else {
    const seenIds = new Map();
    spec.steps.forEach((step, i) => {
      if (typeof step.id !== 'string') return;
      if (seenIds.has(step.id)) {
        violations.push(`Contract: Duplicate step id "${step.id}"`);
      } else {
        seenIds.set(step.id, true);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UOF007',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UOF007',
    message: 'contract-onboarding-flow: all contract rules satisfied',
  };
}
