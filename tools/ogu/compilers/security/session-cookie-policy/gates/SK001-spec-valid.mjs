import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SK001 — spec-valid */
export async function run({ dir }) {
  const specPath = join(dir, 'session-cookie-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'SK001', message: 'No session-cookie-policy.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'SK001', message: 'session-cookie-policy.json is not valid JSON', detail: err.message }; }

  const violations = [];
  if (!spec.app) violations.push('Missing field: app');
  if (!Array.isArray(spec.cookies) || spec.cookies.length === 0) violations.push('Missing field: cookies (non-empty array)');

  if (Array.isArray(spec.cookies)) {
    spec.cookies.forEach((c, i) => {
      if (!c.name) violations.push(`cookies[${i}]: missing field "name"`);
      if (!c.purpose) violations.push(`cookies[${i}]: missing field "purpose"`);
    });
  }

  if (violations.length > 0) return { pass: false, code: 'SK001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'SK001', message: `Spec valid — ${spec.cookies.length} cookie(s) declared` };
}
