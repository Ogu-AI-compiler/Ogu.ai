/**
 * Gate UTK004 — failure-paths
 * At least one failure or cancellation path must exist. Either:
 *   - A step with type="failure" or type="cancellation", OR
 *   - A `failure_paths` array in the spec with at least one entry.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK004',
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
      code: 'UTK004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.steps)) {
    return {
      pass: true,
      code: 'UTK004',
      message: 'No steps array — skipped',
      skipped: true,
    };
  }

  // Check for a step with type="failure" or type="cancellation"
  const failureStep = spec.steps.find(
    s => s.type === 'failure' || s.type === 'cancellation'
  );

  if (failureStep) {
    return {
      pass: true,
      code: 'UTK004',
      message: `failure-paths: found step with type="${failureStep.type}" (id="${failureStep.id ?? 'unknown'}")`,
    };
  }

  // Check for a failure_paths array with at least one entry
  if (Array.isArray(spec.failure_paths) && spec.failure_paths.length > 0) {
    return {
      pass: true,
      code: 'UTK004',
      message: `failure-paths: failure_paths array has ${spec.failure_paths.length} entry/entries`,
    };
  }

  return {
    pass: false,
    code: 'UTK004',
    message: 'No failure or cancellation path declared — task flows must handle failure/cancellation',
    detail:
      'Declare at least one step with type="failure" or type="cancellation", ' +
      'or provide a non-empty failure_paths array at the spec level.',
  };
}
