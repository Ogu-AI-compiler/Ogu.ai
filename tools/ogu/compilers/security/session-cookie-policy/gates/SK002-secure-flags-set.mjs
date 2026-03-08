import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SK002 — secure-flags-set: HttpOnly, Secure, SameSite must be set on all session cookies */
export async function run({ dir }) {
  const specPath = join(dir, 'session-cookie-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'SK002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'SK002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.cookies)) return { pass: true, code: 'SK002', message: 'No cookies — gate skipped', skipped: true };

  const VALID_SAMESITE = new Set(['strict', 'lax', 'none']);
  const violations = [];

  for (const cookie of spec.cookies) {
    const name = cookie.name || '?';

    if (cookie.http_only !== true) {
      violations.push(`Cookie "${name}": http_only must be true — prevents JavaScript access to session identifiers`);
    }
    if (cookie.secure !== true) {
      violations.push(`Cookie "${name}": secure must be true — cookie must only be sent over HTTPS`);
    }
    if (!cookie.same_site || !VALID_SAMESITE.has(String(cookie.same_site || '').toLowerCase())) {
      violations.push(`Cookie "${name}": same_site must be "Strict", "Lax", or "None" — found: ${JSON.stringify(cookie.same_site)}`);
    }
    // SameSite=None requires Secure=true
    if (String(cookie.same_site || '').toLowerCase() === 'none' && cookie.secure !== true) {
      violations.push(`Cookie "${name}": same_site=None requires secure=true`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'SK002', message: `${violations.length} cookie(s) missing security flags`, detail: violations.join('\n') };
  return { pass: true, code: 'SK002', message: `HttpOnly, Secure, SameSite set on all ${spec.cookies.length} cookie(s)` };
}
