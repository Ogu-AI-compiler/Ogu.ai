/**
 * Gate UTK005 — retry-cap
 * Any step with retry:true or maxRetries declared must have maxRetries <= 5.
 * Steps with retryable:true but no maxRetries are violations (infinite retry).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK005',
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
      code: 'UTK005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return {
      pass: true,
      code: 'UTK005',
      message: 'No steps to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const step of spec.steps) {
    const stepLabel = `step(id="${step.id ?? step.order ?? 'unknown'}")`;
    const hasRetryTrue = step.retry === true;
    const hasRetryable = step.retryable === true;
    const hasMaxRetries = typeof step.maxRetries === 'number';

    // retryable:true with no maxRetries is an infinite retry violation
    if (hasRetryable && !hasMaxRetries) {
      violations.push(
        `${stepLabel} has retryable:true but no maxRetries declared — infinite retry is forbidden`
      );
      continue;
    }

    // retry:true with no maxRetries is also infinite retry
    if (hasRetryTrue && !hasMaxRetries) {
      violations.push(
        `${stepLabel} has retry:true but no maxRetries declared — infinite retry is forbidden`
      );
      continue;
    }

    // maxRetries declared — must be an integer <= 5
    if (hasMaxRetries) {
      if (!Number.isInteger(step.maxRetries) || step.maxRetries < 0) {
        violations.push(
          `${stepLabel} maxRetries must be a non-negative integer, got: ${step.maxRetries}`
        );
      } else if (step.maxRetries > 5) {
        violations.push(
          `${stepLabel} maxRetries=${step.maxRetries} exceeds cap of 5 — risk of infinite retry loop`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UTK005',
      message: `${violations.length} retry violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UTK005',
    message: 'retry-cap: all steps comply with maxRetries <= 5 constraint',
  };
}
