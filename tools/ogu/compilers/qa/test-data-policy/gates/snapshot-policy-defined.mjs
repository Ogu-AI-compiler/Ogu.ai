import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA082 — snapshot-policy-defined
 * If the strategy includes "snapshots", a snapshot policy must be defined.
 *
 * Database snapshots as test data are powerful but require careful management:
 *   - Snapshots become stale (schema changes break them)
 *   - Large snapshots slow down CI
 *   - Snapshots can contain PII if not sanitized
 *   - Without a rotation policy, CI starts using 6-month-old data
 *
 * Required when strategy includes "snapshots":
 *   spec.snapshotPolicy.maxAgedays: maximum age in days before snapshot is stale
 *   spec.snapshotPolicy.sanitized: boolean — was PII removed?
 *   spec.snapshotPolicy.updateFrequency: how often snapshots are refreshed
 *
 * If strategy does not include "snapshots", this gate is skipped.
 */

const MAX_SNAPSHOT_AGE_DAYS = 90;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'test-data-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA082', message: 'test-data-policy-spec.json not readable' }; }

  const strategies = Array.isArray(spec.strategy) ? spec.strategy : (spec.strategy ? [spec.strategy] : []);
  if (!strategies.includes('snapshots')) {
    return { pass: true, code: 'QA082', message: 'Strategy does not include snapshots — skipped', skipped: true };
  }

  const policy = spec.snapshotPolicy;
  if (!policy || typeof policy !== 'object') {
    return {
      pass: false, code: 'QA082',
      message: 'Strategy includes "snapshots" but spec.snapshotPolicy not declared',
      detail: 'Add:\n  "snapshotPolicy": {\n    "maxAgeDays": 30,\n    "sanitized": true,\n    "updateFrequency": "weekly"\n  }',
    };
  }

  const violations = [];

  if (typeof policy.maxAgeDays !== 'number' || policy.maxAgeDays < 1) {
    violations.push('snapshotPolicy.maxAgeDays is required (positive integer)');
  } else if (policy.maxAgeDays > MAX_SNAPSHOT_AGE_DAYS) {
    violations.push(`snapshotPolicy.maxAgeDays: ${policy.maxAgeDays} exceeds ${MAX_SNAPSHOT_AGE_DAYS} days — snapshots become stale and may contain schema drift`);
  }

  if (policy.sanitized !== true) {
    violations.push('snapshotPolicy.sanitized must be true — snapshots must have PII removed');
  }

  if (!policy.updateFrequency || typeof policy.updateFrequency !== 'string') {
    violations.push('snapshotPolicy.updateFrequency is required (e.g. "daily", "weekly", "per-sprint")');
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA082',
      message: `${violations.length} snapshot policy issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true, code: 'QA082',
    message: `Snapshot policy valid — maxAgeDays: ${policy.maxAgeDays}, frequency: ${policy.updateFrequency}, sanitized: ${policy.sanitized}`,
  };
}
