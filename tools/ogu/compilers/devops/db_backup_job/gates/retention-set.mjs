/**
 * Gate: retention-set (DBB003)
 * Validates that at least one of retentionCount or retentionDays is declared
 * and is a positive integer. Without a retention policy, backups accumulate
 * indefinitely, filling storage and incurring unbounded cost.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'db-backup-spec.json'), 'utf8'));

  if (!spec.retentionCount && !spec.retentionDays) {
    return {
      pass: false, code: 'DBB003',
      message: 'retentionCount or retentionDays must be set',
      detail: { hint: 'Set retentionCount (number of backups to keep) or retentionDays (how many days to retain backups) to prevent unbounded storage growth' },
    };
  }

  const field = spec.retentionCount !== undefined ? 'retentionCount' : 'retentionDays';
  const val   = spec.retentionCount ?? spec.retentionDays;

  if (!Number.isInteger(val) || val <= 0) {
    return {
      pass: false, code: 'DBB003',
      message: `${field} must be a positive integer`,
      detail: { field, received: val, hint: 'Use a value of 1 or greater' },
    };
  }

  return {
    pass: true, code: 'DBB003',
    message: `Retention: ${spec.retentionCount ? spec.retentionCount + ' backups' : spec.retentionDays + ' days'}`,
  };
}
