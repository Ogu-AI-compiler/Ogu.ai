/**
 * Gate: limits-positive (CP002)
 * Validates that connection count fields are positive integers. Non-positive
 * or non-integer values are rejected by PgBouncer/pgpool at startup with a
 * configuration parse error. A zero poolSize means no connections are pooled.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const NUMERIC_FIELDS = ['maxClientConn', 'poolSize', 'maxConnections'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'connection-pool-spec.json'), 'utf8'));
  const violations = [];

  for (const field of NUMERIC_FIELDS) {
    if (spec[field] !== undefined && (!Number.isInteger(spec[field]) || spec[field] <= 0)) {
      violations.push({
        field,
        value:  spec[field],
        reason: `${field} must be a positive integer`,
        hint:   'Use a value of 1 or greater',
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CP002',
      message: `${violations.length} non-positive connection limit(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'CP002', message: 'All numeric limits are positive integers' };
}
