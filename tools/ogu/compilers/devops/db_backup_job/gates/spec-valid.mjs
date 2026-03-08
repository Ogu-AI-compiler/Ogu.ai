/**
 * Gate: spec-valid (DBB001)
 * Validates that db-backup-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields cause downstream gates (retention,
 * checksum, encryption) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['command', 'destination', 'schedule', 'retentionCount'];

export async function run({ dir }) {
  const specPath = join(dir, 'db-backup-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'DBB001',
      message: 'db-backup-spec.json not found',
      detail: { searched: specPath, hint: 'Create db-backup-spec.json with command, destination, schedule, and retentionCount fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'DBB001', message: `db-backup-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'DBB001',
      message: `db-backup-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED },
    };
  }

  return { pass: true, code: 'DBB001', message: `db-backup-spec.json valid — schedule: ${spec.schedule}` };
}
