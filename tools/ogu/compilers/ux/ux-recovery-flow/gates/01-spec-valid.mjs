/**
 * Gate URF001 — spec-valid
 * recovery-flow-spec.json must exist with:
 * - failures (array) — each failure has id (string), trigger (string), recovery (object)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF001',
      message: 'recovery-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'URF001',
      message: `recovery-flow-spec.json parse error: ${err.message}`,
    };
  }

  if (!Array.isArray(spec.failures)) {
    return {
      pass: false,
      code: 'URF001',
      message: 'recovery-flow-spec.json missing required field: failures (array)',
    };
  }

  if (spec.failures.length === 0) {
    return {
      pass: false,
      code: 'URF001',
      message: 'failures array is empty — at least one failure must be declared',
    };
  }

  const violations = [];

  spec.failures.forEach((failure, i) => {
    if (typeof failure.id !== 'string' || failure.id.trim() === '') {
      violations.push(`failures[${i}] missing or empty field: id (string)`);
    }
    if (typeof failure.trigger !== 'string' || failure.trigger.trim() === '') {
      violations.push(
        `failures[${i}](id="${failure.id ?? 'unknown'}") missing or empty field: trigger (string)`
      );
    }
    if (typeof failure.recovery !== 'object' || failure.recovery === null || Array.isArray(failure.recovery)) {
      violations.push(
        `failures[${i}](id="${failure.id ?? 'unknown'}") missing field: recovery (object)`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF001',
      message: `${violations.length} structural violation(s) in recovery-flow-spec.json`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF001',
    message: `spec-valid: ${spec.failures.length} failure(s) declared`,
  };
}
