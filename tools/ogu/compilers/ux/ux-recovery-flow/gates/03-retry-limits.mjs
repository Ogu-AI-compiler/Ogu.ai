/**
 * Gate URF003 — retry-limits
 * Every recovery with `retry: true` or `maxRetries` defined must have:
 * - maxRetries >= 1 and <= 10
 * Infinite retry (retry:true with no maxRetries) is always a violation.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF003',
      message: 'recovery-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'URF003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.failures) || spec.failures.length === 0) {
    return {
      pass: true,
      code: 'URF003',
      message: 'No failures to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const failure of spec.failures) {
    if (typeof failure.recovery !== 'object' || failure.recovery === null) continue;

    const label = `failure(id="${failure.id ?? 'unknown'}")`;
    const hasRetryTrue = failure.recovery.retry === true;
    const hasMaxRetries = typeof failure.recovery.maxRetries === 'number';

    // retry:true with no maxRetries → infinite retry
    if (hasRetryTrue && !hasMaxRetries) {
      violations.push(
        `${label} recovery.retry=true but no maxRetries declared — infinite retry is forbidden`
      );
      continue;
    }

    // maxRetries declared — must be integer 1..10
    if (hasMaxRetries) {
      const mr = failure.recovery.maxRetries;
      if (!Number.isInteger(mr)) {
        violations.push(`${label} recovery.maxRetries must be an integer, got: ${mr}`);
      } else if (mr < 1) {
        violations.push(`${label} recovery.maxRetries=${mr} must be >= 1`);
      } else if (mr > 10) {
        violations.push(`${label} recovery.maxRetries=${mr} exceeds maximum of 10`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF003',
      message: `${violations.length} retry limit violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF003',
    message: 'retry-limits: all retry configurations have valid maxRetries (1–10)',
  };
}
