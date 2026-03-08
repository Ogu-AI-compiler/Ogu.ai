/**
 * Gate: checksum-generation (DBB004)
 * Validates that the backup job generates a checksum, manifest, or verification
 * artifact. Without integrity verification, a corrupted backup is indistinguishable
 * from a valid one until a restore is attempted — at which point data is already lost.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'db-backup-spec.json'), 'utf8'));

  if (!spec.checksumEnabled && !spec.manifestFile && !spec.verificationScript) {
    return {
      pass: false, code: 'DBB004',
      message: 'No checksum or manifest generation step — backup integrity cannot be verified',
      detail: {
        hint:    'Set checksumEnabled: true to generate SHA checksums, or specify manifestFile/verificationScript for custom integrity checks',
        options: ['checksumEnabled: true', 'manifestFile: "backup.manifest"', 'verificationScript: "scripts/verify-backup.sh"'],
      },
    };
  }

  return { pass: true, code: 'DBB004', message: 'Checksum/manifest generation configured' };
}
