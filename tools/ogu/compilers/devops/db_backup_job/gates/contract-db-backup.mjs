/**
 * Gate: contract-db-backup (DBB007)
 * Validates that db-backup-spec.json satisfies the backup contract: backups
 * at rest must be encrypted, and a storage destination must be declared to
 * ensure backups land in a known, auditable location.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'db-backup-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.encryptionEnabled && !spec.encryptionKey && !spec.skipEncryptionCheck) {
    violations.push({
      rule:   'encryption-required',
      reason: 'Backup encryption not configured — database backups at rest should be encrypted',
      hint:   'Set encryptionEnabled: true, or add encryptionKey pointing to a KMS key. Set skipEncryptionCheck: true with justification if encryption is handled at the storage layer.',
    });
  }
  if (!spec.storageClass && !spec.storageDestination) {
    violations.push({
      rule:   'storage-destination-required',
      reason: 'No storage destination declared — backup location is not auditable',
      hint:   'Set storageDestination (e.g., "s3://my-bucket/backups") or storageClass to define where backups are written',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DBB007',
      message: `${violations.length} contract violation(s) in db-backup-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DBB007', message: 'DB backup contract satisfied' };
}
