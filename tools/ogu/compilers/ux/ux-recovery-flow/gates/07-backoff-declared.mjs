/**
 * Gate URF007 — backoff-declared
 * Any recovery with `retry: true` and maxRetries > 1 must declare
 * `backoff`: "linear" | "exponential" | "fixed"
 * Missing backoff means retries will hammer the server at full rate.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_BACKOFF = new Set(['linear', 'exponential', 'fixed']);

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF007',
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
      code: 'URF007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.failures) || spec.failures.length === 0) {
    return {
      pass: true,
      code: 'URF007',
      message: 'No failures to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const failure of spec.failures) {
    if (typeof failure.recovery !== 'object' || failure.recovery === null) continue;

    const recovery = failure.recovery;
    const label = `failure(id="${failure.id ?? 'unknown'}")`;

    const hasRetryTrue = recovery.retry === true;
    const maxRetries = recovery.maxRetries;
    const hasMultipleRetries =
      typeof maxRetries === 'number' && Number.isInteger(maxRetries) && maxRetries > 1;

    // Gate applies when retry:true and maxRetries > 1
    if (!hasRetryTrue || !hasMultipleRetries) continue;

    const backoff = recovery.backoff;

    if (typeof backoff !== 'string') {
      violations.push(
        `${label} recovery.retry=true, maxRetries=${maxRetries} but no backoff declared — ` +
        `must be one of: ${[...VALID_BACKOFF].join(', ')}`
      );
      continue;
    }

    if (!VALID_BACKOFF.has(backoff)) {
      violations.push(
        `${label} recovery.backoff="${backoff}" is invalid — ` +
        `must be one of: ${[...VALID_BACKOFF].join(', ')}`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF007',
      message: `${violations.length} multi-retry recovery/ies missing backoff declaration`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF007',
    message: 'backoff-declared: all multi-retry recoveries declare a backoff strategy',
  };
}
