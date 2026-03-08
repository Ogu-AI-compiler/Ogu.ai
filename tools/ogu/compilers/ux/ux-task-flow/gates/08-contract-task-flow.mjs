/**
 * Gate UTK008 — contract-task-flow
 * Final contract check:
 * - version declared
 * - unique step ids (if steps have id field)
 * - at least one step with actor="user"
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK008',
      message: 'task-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UTK008',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.steps)) {
    return {
      pass: true,
      code: 'UTK008',
      message: 'No steps array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Rule: version declared
  if (!spec.version) {
    violations.push('Contract: task-flow-spec.json missing field "version"');
  }

  // Rule: unique step ids (only enforced when steps carry id fields)
  const stepsWithIds = spec.steps.filter(s => typeof s.id === 'string');
  if (stepsWithIds.length > 0) {
    const seenIds = new Map();
    for (const step of stepsWithIds) {
      if (seenIds.has(step.id)) {
        violations.push(`Contract: Duplicate step id "${step.id}"`);
      } else {
        seenIds.set(step.id, true);
      }
    }
  }

  // Rule: at least one step with actor="user"
  const userSteps = spec.steps.filter(s => s.actor === 'user');
  if (userSteps.length === 0) {
    violations.push(
      'Contract: No step with actor="user" — every task flow must involve at least one user action'
    );
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTK008',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTK008',
    message: 'contract-task-flow: all contract rules satisfied',
  };
}
