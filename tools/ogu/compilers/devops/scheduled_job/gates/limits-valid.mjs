/**
 * Gate: limits-valid (SJ005)
 * Validates that job history and retry limits are non-negative integers when
 * declared. Negative or non-integer values are rejected by the Kubernetes API
 * server at resource creation time with a validation error.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const LIMIT_FIELDS = ['backoffLimit', 'successfulJobsHistoryLimit', 'failedJobsHistoryLimit'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'scheduled-job-spec.json'), 'utf8'));
  const violations = [];

  for (const field of LIMIT_FIELDS) {
    if (spec[field] !== undefined) {
      if (!Number.isInteger(spec[field]) || spec[field] < 0) {
        violations.push({
          field,
          value:  spec[field],
          reason: `${field} must be a non-negative integer`,
          hint:   'Use 0 to disable history retention, or a positive integer for the desired limit',
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SJ005',
      message: `${violations.length} job limit issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'SJ005', message: 'Job limits are valid' };
}
