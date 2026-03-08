import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SK004 — csrf-protection-declared: cookie-based session must declare CSRF protection mode */
export async function run({ dir }) {
  const specPath = join(dir, 'session-cookie-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'SK004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'SK004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  const sessionCookies = Array.isArray(spec.cookies)
    ? spec.cookies.filter(c => {
        const purpose = String(c.purpose || '').toLowerCase();
        return purpose.includes('session') || purpose.includes('auth') || c.is_session === true;
      })
    : [];

  if (sessionCookies.length === 0) return { pass: true, code: 'SK004', message: 'No session cookies — gate skipped', skipped: true };

  // If SameSite=Strict or Lax, CSRF is handled by the browser; if None, explicit CSRF protection is needed
  const VALID_CSRF_MODES = new Set(['double-submit-cookie', 'synchronizer-token', 'same-site', 'custom-header', 'origin-check']);
  const violations = [];

  for (const cookie of sessionCookies) {
    const name = cookie.name || '?';
    const sameSite = String(cookie.same_site || '').toLowerCase();

    if (sameSite === 'none') {
      // SameSite=None does not protect against CSRF — must have explicit protection
      const hasCsrf = cookie.csrf_protection || spec.csrf_protection;
      if (!hasCsrf) {
        violations.push(`Session cookie "${name}": SameSite=None provides no CSRF protection — declare csrf_protection mode (e.g. "synchronizer-token" or "double-submit-cookie")`);
      } else {
        const mode = String(hasCsrf).toLowerCase();
        if (!VALID_CSRF_MODES.has(mode)) {
          violations.push(`Session cookie "${name}": csrf_protection "${hasCsrf}" is not a recognized mode — use: ${[...VALID_CSRF_MODES].join(', ')}`);
        }
      }
    }
  }

  if (violations.length > 0) return { pass: false, code: 'SK004', message: `${violations.length} session cookie(s) missing CSRF protection`, detail: violations.join('\n') };
  return { pass: true, code: 'SK004', message: 'CSRF protection properly declared' };
}
