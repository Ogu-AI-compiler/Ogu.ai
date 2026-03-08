/**
 * Gate: contract-backup-verify (BV007)
 * Validates that backup-verify-spec.json satisfies the verification contract:
 * failed verifications must trigger an alert (backups that cannot be restored
 * are not backups), and an owner must be declared for on-call routing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'backup-verify-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.notifyOnFailure && !spec.alertChannel) {
    violations.push({
      rule:   'failure-notification-required',
      reason: 'No failure notification channel declared — a failed backup verification must alert on-call immediately',
      hint:   'Add alertChannel: "pagerduty" or notifyOnFailure: true to ensure failures are actioned',
    });
  }
  if (!spec.owner) {
    violations.push({
      rule:   'owner-required',
      reason: 'No owner declared — on-call routing cannot be determined when verification fails',
      hint:   'Add owner: "team-name" or an email address',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'BV007',
      message: `${violations.length} contract violation(s) in backup-verify-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'BV007', message: 'Backup verification contract satisfied' };
}
