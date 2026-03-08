import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** VE001 — spec-valid */
export async function run({ dir }) {
  const specPath = join(dir, 'vuln-exception-record.json');
  if (!existsSync(specPath)) return { pass: true, code: 'VE001', message: 'No vuln-exception-record.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'VE001', message: 'vuln-exception-record.json is not valid JSON', detail: err.message }; }

  const violations = [];
  const REQUIRED = ['id', 'vulnerability_id', 'affected_component', 'justification', 'mitigation_context', 'expiry_date', 'approver'];

  for (const field of REQUIRED) {
    if (!spec[field]) violations.push(`Missing required field: "${field}"`);
  }

  if (violations.length > 0) return { pass: false, code: 'VE001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'VE001', message: `Spec valid — exception for ${spec.vulnerability_id}` };
}
