/**
 * Gate UTK001 — spec-valid
 * task-flow-spec.json must exist with:
 * - task_id (string)
 * - steps (array)
 * - completion_criteria (array)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK001',
      message: 'task-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UTK001',
      message: `task-flow-spec.json parse error: ${err.message}`,
    };
  }

  const missing = [];
  if (typeof spec.task_id !== 'string' || spec.task_id.trim() === '') {
    missing.push('task_id (string)');
  }
  if (!Array.isArray(spec.steps)) {
    missing.push('steps (array)');
  }
  if (!Array.isArray(spec.completion_criteria)) {
    missing.push('completion_criteria (array)');
  }

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UTK001',
      message: `task-flow-spec.json missing required fields: ${missing.join(', ')}`,
    };
  }

  if (spec.steps.length === 0) {
    return {
      pass: false,
      code: 'UTK001',
      message: 'steps array is empty — at least one step is required',
    };
  }

  return {
    pass: true,
    code: 'UTK001',
    message: `spec-valid: task_id="${spec.task_id}", ${spec.steps.length} step(s), ${spec.completion_criteria.length} criterion/a`,
  };
}
