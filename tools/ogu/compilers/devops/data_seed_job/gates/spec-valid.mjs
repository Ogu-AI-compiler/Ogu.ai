/**
 * Gate: spec-valid (DS001)
 * Validates that data-seed-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields cause downstream gates (command path,
 * production target check, DB ref validation) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['name', 'command', 'targetEnvironments'];

export async function run({ dir }) {
  const specPath = join(dir, 'data-seed-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'DS001',
      message: 'data-seed-spec.json not found',
      detail: { searched: specPath, hint: 'Create data-seed-spec.json with name, command, and targetEnvironments fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'DS001', message: `data-seed-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'DS001',
      message: `data-seed-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED },
    };
  }

  return { pass: true, code: 'DS001', message: `data-seed-spec.json valid — "${spec.name}"` };
}
