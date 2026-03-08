/**
 * Gate: wal-archiving (DBP006)
 * For production environments with RPO < 24 hours, WAL archiving must be enabled.
 * WAL archiving is the foundation of PITR — without it, the only recovery
 * mechanism is a full snapshot restore, which can lose up to snapshot_frequency
 * worth of data.
 *
 * If wal_archiving is true, wal_archive_target must be declared (where WAL
 * segments are shipped — S3, GCS, object storage, etc.).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SHORT_RPO_THRESHOLD_HOURS = 24;

export async function run({ dir }) {
  const specPath = join(dir, 'backup-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DBP006', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DBP006', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const rpoHours = typeof spec.rpo_hours === 'number' ? spec.rpo_hours : null;

  // Only enforce WAL archiving when RPO < 24h or when explicitly required
  const requiresWal = rpoHours !== null && rpoHours < SHORT_RPO_THRESHOLD_HOURS;

  if (!requiresWal) {
    // Still check: if wal_archiving is true, wal_archive_target must be declared
    if (spec.wal_archiving === true && !spec.wal_archive_target) {
      return {
        pass: false,
        code: 'DBP006',
        message: 'wal_archiving is true but wal_archive_target is not declared',
        detail: 'When wal_archiving is enabled, wal_archive_target must declare where WAL segments are shipped (e.g., "s3://my-bucket/wal/").',
      };
    }
    return {
      pass: true,
      code: 'DBP006',
      message: `rpo_hours (${rpoHours ?? 'not set'}) >= ${SHORT_RPO_THRESHOLD_HOURS}h — WAL archiving not required`,
      skipped: !spec.wal_archiving,
    };
  }

  if (spec.wal_archiving !== true) {
    return {
      pass: false,
      code: 'DBP006',
      message: `rpo_hours is ${rpoHours}h (< ${SHORT_RPO_THRESHOLD_HOURS}h) but wal_archiving is not enabled`,
      detail:
        `With an RPO of ${rpoHours} hours, snapshot-only backups are insufficient.\n` +
        'WAL archiving must be enabled to support Point-in-Time Recovery.\n' +
        'Set wal_archiving: true and declare a wal_archive_target.',
    };
  }

  if (!spec.wal_archive_target) {
    return {
      pass: false,
      code: 'DBP006',
      message: 'wal_archiving is true but wal_archive_target is not declared',
      detail: 'Declare wal_archive_target as the storage location for WAL segments (e.g., "s3://my-bucket/wal/").',
    };
  }

  return {
    pass: true,
    code: 'DBP006',
    message: `WAL archiving enabled (target: ${spec.wal_archive_target})`,
  };
}
