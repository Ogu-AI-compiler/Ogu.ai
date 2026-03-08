/**
 * Gate: geo-redundancy (DBP005)
 * Production backup storage must be geo-redundant (stored in a different
 * geographic region or AZ than the primary instance). A backup stored in the
 * same AZ as the primary is destroyed in the same disaster that takes out
 * the database — making the backup useless for actual disaster recovery.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'backup-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DBP005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DBP005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  // Only enforce geo-redundancy for production
  if (spec.ha_tier && spec.ha_tier !== 'production') {
    return {
      pass: true,
      code: 'DBP005',
      message: `ha_tier is "${spec.ha_tier}" — geo-redundancy check only applies to production`,
      skipped: true,
    };
  }

  if (spec.geo_redundant !== true) {
    return {
      pass: false,
      code: 'DBP005',
      message: 'Production backup storage must be geo_redundant: true',
      detail:
        'Backups stored in the same region as the primary database are destroyed in a regional outage.\n' +
        'A non-geo-redundant backup provides zero protection against a regional disaster.\n' +
        'Set geo_redundant: true and configure cross-region backup storage.',
    };
  }

  return {
    pass: true,
    code: 'DBP005',
    message: 'Backup storage is geo-redundant',
  };
}
