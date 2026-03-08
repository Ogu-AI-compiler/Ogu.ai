/**
 * Gate: spec-valid (BV001)
 * Validates that backup-verify-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields cause downstream gates (verification
 * queries, result artifact, trigger) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['backupSource', 'restoreTarget', 'verifyQueries'];

export async function run({ dir }) {
  const specPath = join(dir, 'backup-verify-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'BV001',
      message: 'backup-verify-spec.json not found',
      detail: { searched: specPath, hint: 'Create backup-verify-spec.json with backupSource, restoreTarget, and verifyQueries fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'BV001', message: `backup-verify-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'BV001',
      message: `backup-verify-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED },
    };
  }

  return { pass: true, code: 'BV001', message: 'backup-verify-spec.json valid' };
}
