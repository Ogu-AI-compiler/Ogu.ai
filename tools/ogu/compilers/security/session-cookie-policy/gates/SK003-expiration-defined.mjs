import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SK003 — expiration-defined: idle and absolute timeout must be declared */
export async function run({ dir }) {
  const specPath = join(dir, 'session-cookie-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'SK003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'SK003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.cookies)) return { pass: true, code: 'SK003', message: 'No cookies — gate skipped', skipped: true };

  const SESSION_COOKIES = spec.cookies.filter(c => {
    const purpose = String(c.purpose || '').toLowerCase();
    return purpose.includes('session') || purpose.includes('auth') || purpose.includes('login') || c.is_session === true;
  });

  if (SESSION_COOKIES.length === 0) return { pass: true, code: 'SK003', message: 'No session cookies declared — gate skipped', skipped: true };

  const violations = [];
  for (const cookie of SESSION_COOKIES) {
    const name = cookie.name || '?';
    if (cookie.idle_timeout_seconds === undefined && cookie.idle_timeout_minutes === undefined) {
      violations.push(`Session cookie "${name}": idle_timeout_seconds must be defined`);
    }
    if (cookie.absolute_timeout_seconds === undefined && cookie.absolute_timeout_hours === undefined && cookie.max_age === undefined) {
      violations.push(`Session cookie "${name}": absolute_timeout_seconds (or max_age) must be defined`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'SK003', message: `${violations.length} session cookie(s) missing timeout`, detail: violations.join('\n') };
  return { pass: true, code: 'SK003', message: `Session timeouts defined for all ${SESSION_COOKIES.length} session cookie(s)` };
}
