import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** VE002 — expiry-within-90-days: vulnerability waivers must expire within 90 days */
export async function run({ dir }) {
  const specPath = join(dir, 'vuln-exception-record.json');
  if (!existsSync(specPath)) return { pass: true, code: 'VE002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'VE002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.expiry_date) return { pass: true, code: 'VE002', message: 'No expiry_date — gate skipped', skipped: true };

  const expiry = new Date(spec.expiry_date);
  if (isNaN(expiry.getTime())) {
    return { pass: false, code: 'VE002', message: `expiry_date "${spec.expiry_date}" is not a valid ISO date` };
  }

  const now = new Date();
  if (expiry < now) {
    return { pass: false, code: 'VE002', message: `expiry_date "${spec.expiry_date}" is in the past — renew or revoke this exception` };
  }

  const MAX_DAYS = 90;
  const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiry > MAX_DAYS) {
    return {
      pass: false,
      code: 'VE002',
      message: `expiry_date is ${daysUntilExpiry} days from now — exceeds maximum of ${MAX_DAYS} days for vulnerability exceptions`,
    };
  }

  return { pass: true, code: 'VE002', message: `Exception expires in ${daysUntilExpiry} days (within 90-day limit)` };
}
