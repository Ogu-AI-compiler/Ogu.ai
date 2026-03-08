import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA025 — retries-ci-only
 * spec.retries.local must be 0 (or absent).
 *
 * Local retries mask flaky tests. When a test fails locally but passes on
 * retry, developers don't investigate — they assume it's a race condition
 * and move on. The flakiness accumulates and eventually breaks CI unpredictably.
 *
 * Retries in CI (retries.ci > 0) are acceptable because CI environments have
 * more resource contention, slower networks, and shared infrastructure that
 * genuinely causes transient failures outside the test's control.
 *
 * Rule:
 * - retries.local must be 0 or not set
 * - retries.ci may be > 0 but should not exceed 3 (more than 3 = flaky test)
 */

const MAX_CI_RETRIES = 3;

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'e2e-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA025', message: 'e2e-spec.json not readable' };
  }

  const retries = spec.retries;
  if (!retries) {
    // Not declared — acceptable (defaults to 0)
    return { pass: true, code: 'QA025', message: 'retries not declared — defaults to 0 local, 0 CI' };
  }

  const localRetries = retries.local ?? 0;
  const ciRetries = retries.ci ?? 0;

  if (localRetries > 0) {
    return {
      pass: false, code: 'QA025',
      message: `retries.local is ${localRetries} — must be 0`,
      detail: `Local retries hide flaky tests. Set retries.local: 0 and fix the underlying flakiness instead.\nFlaky tests that need local retries should be investigated, not silenced.`,
    };
  }

  if (ciRetries > MAX_CI_RETRIES) {
    return {
      pass: false, code: 'QA025',
      message: `retries.ci is ${ciRetries} — exceeds max of ${MAX_CI_RETRIES}`,
      detail: `More than ${MAX_CI_RETRIES} CI retries indicates a structurally flaky test. Fix the test rather than adding more retries.`,
    };
  }

  return {
    pass: true, code: 'QA025',
    message: `Retry policy valid — local: ${localRetries}, CI: ${ciRetries}`,
  };
}
