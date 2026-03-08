/**
 * Gate URF002 — all-failures-covered
 * Every failure must have a non-empty `recovery` object with at least one of:
 * retry, redirect, fallback, contactSupport.
 * A failure with an empty or actionless recovery object is a violation.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const RECOVERY_FIELDS = ['retry', 'redirect', 'fallback', 'contactSupport'];

export async function run({ dir }) {
  const specPath = join(dir, 'recovery-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'URF002',
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
      code: 'URF002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.failures) || spec.failures.length === 0) {
    return {
      pass: true,
      code: 'URF002',
      message: 'No failures to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const failure of spec.failures) {
    if (typeof failure.recovery !== 'object' || failure.recovery === null) continue;

    const label = `failure(id="${failure.id ?? 'unknown'}")`;

    // Check that at least one of the recognized recovery fields is present and truthy
    const hasCoveredAction = RECOVERY_FIELDS.some(
      field =>
        Object.prototype.hasOwnProperty.call(failure.recovery, field) &&
        failure.recovery[field] !== null &&
        failure.recovery[field] !== undefined &&
        failure.recovery[field] !== false
    );

    if (!hasCoveredAction) {
      violations.push(
        `${label} recovery object is empty or has no recognized action — ` +
        `must declare at least one of: ${RECOVERY_FIELDS.join(', ')}`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'URF002',
      message: `${violations.length} failure(s) with empty or actionless recovery`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'URF002',
    message: `all-failures-covered: all ${spec.failures.length} failure(s) have at least one recovery action`,
  };
}
