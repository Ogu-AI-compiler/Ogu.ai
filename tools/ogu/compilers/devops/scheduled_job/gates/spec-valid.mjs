/**
 * Gate: spec-valid (SJ001)
 * Validates that scheduled-job-spec.json exists, is valid JSON, and declares
 * all required fields. Missing fields cause downstream gates (cron validation,
 * concurrency policy, job template checks) to fail with misleading errors.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED = ['name', 'schedule', 'command', 'image'];

export async function run({ dir }) {
  const specPath = join(dir, 'scheduled-job-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'SJ001',
      message: 'scheduled-job-spec.json not found',
      detail: { searched: specPath, hint: 'Create scheduled-job-spec.json with name, schedule, command, and image fields' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SJ001', message: `scheduled-job-spec.json is not valid JSON: ${e.message}` };
  }

  const missing = REQUIRED.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'SJ001',
      message: `scheduled-job-spec.json missing required field(s): ${missing.join(', ')}`,
      detail: { missing, required: REQUIRED },
    };
  }

  return { pass: true, code: 'SJ001', message: `scheduled-job-spec.json valid — "${spec.name}"` };
}
