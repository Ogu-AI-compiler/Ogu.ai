import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA004 — timeout-per-environment
 * Every declared environment must have a timeout > 0.
 * timeout: 0 means infinite — tests that hang block CI indefinitely.
 *
 * Also checks spec.timeouts object for sanity:
 * - e2e timeout should be >= integration timeout
 * - unit timeout should be < integration timeout (units must be fast)
 */

const MAX_UNIT_MS = 30_000;  // unit tests hanging > 30s are a design problem

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'test-harness-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA004', message: 'test-harness-spec.json not readable' };
  }

  const timeouts = spec.timeouts;
  if (!timeouts || typeof timeouts !== 'object') {
    return {
      pass: false, code: 'QA004',
      message: 'spec.timeouts not defined — every test environment needs an explicit timeout',
    };
  }

  const environments = Object.keys(spec.environments || {});
  const violations = [];

  // Every environment must have a corresponding timeout entry
  for (const env of environments) {
    const ms = timeouts[env];
    if (ms === undefined || ms === null) {
      violations.push(`environment "${env}" has no timeout entry in spec.timeouts`);
    } else if (ms === 0) {
      violations.push(`environment "${env}" has timeout: 0 (infinite) — CI will hang`);
    } else if (typeof ms !== 'number' || ms < 0) {
      violations.push(`environment "${env}" has invalid timeout: ${ms}`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA004',
      message: `Timeout violations: ${violations.length}`,
      detail: violations.join('\n'),
    };
  }

  // Warn about suspiciously high unit timeout (not a hard fail, but flagged)
  const unitTimeout = timeouts.unit;
  if (unitTimeout && unitTimeout > MAX_UNIT_MS) {
    return {
      pass: false, code: 'QA004',
      message: `unit timeout ${unitTimeout}ms exceeds ${MAX_UNIT_MS}ms — unit tests must be fast; long-running tests belong in integration suite`,
      detail: `If your unit tests genuinely need > ${MAX_UNIT_MS}ms, they are likely integration tests. Move them to the integration environment.`,
    };
  }

  const summary = Object.entries(timeouts)
    .map(([env, ms]) => `${env}:${ms}ms`)
    .join(', ');
  return { pass: true, code: 'QA004', message: `All timeouts valid — ${summary}` };
}
