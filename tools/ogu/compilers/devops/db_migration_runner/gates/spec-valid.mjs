/**
 * Gate: spec-valid (MR001)
 * Validates that db-migration-runner-spec.json exists, is valid JSON, and
 * declares all required fields. Missing fields cause downstream gates (migration
 * dir, command allowlist, ordering policy) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['command', 'migrationDir', 'orderingPolicy'];

export async function run({ dir }) {
  const specPath = join(dir, 'db-migration-runner-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'MR001',
      message: 'db-migration-runner-spec.json not found',
      detail: { searched: specPath, hint: 'Create db-migration-runner-spec.json with command, migrationDir, and orderingPolicy fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'MR001', message: `db-migration-runner-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'MR001',
      message: `db-migration-runner-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED },
    };
  }

  return { pass: true, code: 'MR001', message: 'db-migration-runner-spec.json valid' };
}
