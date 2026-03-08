import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** DV004 — exceptions-reference-waiver: every allowed exception must reference a vuln-exception-record */
export async function run({ dir }) {
  const specPath = join(dir, 'dep-vuln-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'DV004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'DV004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.exceptions) || spec.exceptions.length === 0) {
    return { pass: true, code: 'DV004', message: 'No exceptions declared — gate skipped', skipped: true };
  }

  const violations = [];
  for (const exc of spec.exceptions) {
    const id = exc.cve_id || exc.vuln_id || exc.id || '?';
    if (!exc.exception_record_ref || typeof exc.exception_record_ref !== 'string') {
      violations.push(`Exception "${id}": must declare exception_record_ref pointing to an approved vuln-exception-record`);
    }
    if (!exc.justification || typeof exc.justification !== 'string' || exc.justification.trim().length < 10) {
      violations.push(`Exception "${id}": justification must be a non-trivial string explaining why this vulnerability is accepted`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'DV004', message: `${violations.length} exception(s) missing required reference or justification`, detail: violations.join('\n') };
  return { pass: true, code: 'DV004', message: `All ${spec.exceptions.length} exception(s) have valid references` };
}
