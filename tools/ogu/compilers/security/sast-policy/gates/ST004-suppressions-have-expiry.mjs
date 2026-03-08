import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ST004 — suppressions-have-expiry: suppression entries must declare an expiry date and justification */
export async function run({ dir }) {
  const specPath = join(dir, 'sast-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'ST004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'ST004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.suppressions) || spec.suppressions.length === 0) {
    return { pass: true, code: 'ST004', message: 'No suppressions declared — gate skipped', skipped: true };
  }

  const violations = [];
  const now = new Date();

  for (const sup of spec.suppressions) {
    const id = sup.rule_id || sup.id || '?';

    if (!sup.justification || typeof sup.justification !== 'string' || sup.justification.trim().length < 10) {
      violations.push(`Suppression "${id}": justification must be a meaningful string`);
    }
    if (!sup.expiry_date && !sup.expires) {
      violations.push(`Suppression "${id}": expiry_date must be declared — suppressions must not be permanent`);
    } else {
      const expiryStr = sup.expiry_date || sup.expires;
      const expiry = new Date(expiryStr);
      if (isNaN(expiry.getTime())) {
        violations.push(`Suppression "${id}": expiry_date "${expiryStr}" is not a valid date`);
      } else if (expiry < now) {
        violations.push(`Suppression "${id}": expiry_date "${expiryStr}" is in the past — renew or remove this suppression`);
      }
    }
  }

  if (violations.length > 0) return { pass: false, code: 'ST004', message: `${violations.length} suppression(s) missing expiry or justification`, detail: violations.join('\n') };
  return { pass: true, code: 'ST004', message: `All ${spec.suppressions.length} suppression(s) have expiry dates and justifications` };
}
