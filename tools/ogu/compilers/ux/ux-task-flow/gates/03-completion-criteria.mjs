/**
 * Gate UTK003 — completion-criteria
 * completion_criteria array must be non-empty and each criterion must have a `description` string.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK003',
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
      code: 'UTK003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.completion_criteria)) {
    return {
      pass: true,
      code: 'UTK003',
      message: 'No completion_criteria array — skipped',
      skipped: true,
    };
  }

  if (spec.completion_criteria.length === 0) {
    return {
      pass: false,
      code: 'UTK003',
      message: 'completion_criteria array is empty — at least one criterion is required',
    };
  }

  const violations = [];
  spec.completion_criteria.forEach((criterion, i) => {
    if (typeof criterion.description !== 'string' || criterion.description.trim() === '') {
      violations.push(`completion_criteria[${i}] missing or empty field: description (string)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTK003',
      message: `${violations.length} criterion/a missing description`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTK003',
    message: `completion-criteria: ${spec.completion_criteria.length} criterion/a, all have descriptions`,
  };
}
