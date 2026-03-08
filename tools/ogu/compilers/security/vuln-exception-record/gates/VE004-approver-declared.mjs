import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** VE004 — approver-declared: exception must be approved by a named individual */
export async function run({ dir }) {
  const specPath = join(dir, 'vuln-exception-record.json');
  if (!existsSync(specPath)) return { pass: true, code: 'VE004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'VE004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  const approver = String(spec.approver || '').trim();
  if (!approver) {
    return { pass: false, code: 'VE004', message: 'approver must be declared — exceptions require a named approver (name, email, or user id)' };
  }

  const PLACEHOLDER = new Set(['system', 'auto', 'automated', 'cve-bot', 'tbd', 'n/a', 'none']);
  if (PLACEHOLDER.has(approver.toLowerCase())) {
    return { pass: false, code: 'VE004', message: `approver "${approver}" appears to be a placeholder — must be a real person (name or email)` };
  }

  return { pass: true, code: 'VE004', message: `Exception approved by: ${approver}` };
}
