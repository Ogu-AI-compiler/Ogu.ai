import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RL003 — auth-endpoints-stricter: auth endpoints must have lower rate limits than standard GET endpoints */
export async function run({ dir }) {
  const specPath = join(dir, 'rate-limit-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'RL003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'RL003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.endpoints)) return { pass: true, code: 'RL003', message: 'No endpoints — gate skipped', skipped: true };

  const AUTH_PATH_PATTERNS = [/login/, /signin/, /sign-in/, /auth/, /token/, /password\/reset/, /forgot-password/, /otp/, /verify/];

  const authEndpoints = spec.endpoints.filter(ep =>
    AUTH_PATH_PATTERNS.some(p => p.test(String(ep.path || '').toLowerCase())) ||
    String(ep.sensitivity || '').toLowerCase() === 'auth'
  );

  if (authEndpoints.length === 0) {
    return { pass: true, code: 'RL003', message: 'No auth endpoints detected — gate skipped', skipped: true };
  }

  // Find the max RPM across non-auth GET endpoints to compare
  const standardGetRpm = spec.endpoints
    .filter(ep => String(ep.method || '').toLowerCase() === 'get' && !AUTH_PATH_PATTERNS.some(p => p.test(String(ep.path || '').toLowerCase())))
    .map(ep => ep.per_ip_rpm || ep.rpm || ep.requests_per_minute || 0)
    .filter(v => v > 0);

  const minStandardRpm = standardGetRpm.length > 0 ? Math.min(...standardGetRpm) : null;
  const violations = [];

  for (const ep of authEndpoints) {
    const id = `${ep.method} ${ep.path}`;
    const authRpm = ep.per_ip_rpm || ep.rpm || ep.requests_per_minute;

    if (authRpm === undefined || authRpm === null) {
      violations.push(`Auth endpoint "${id}": must declare a rate limit (per_ip_rpm or rpm)`);
      continue;
    }

    // Auth endpoints must be stricter: recommend ≤ 10 rpm for login/reset
    const isLoginEndpoint = /login|signin|sign-in|password|otp/.test(String(ep.path || '').toLowerCase());
    if (isLoginEndpoint && authRpm > 20) {
      violations.push(`Auth endpoint "${id}": rate limit of ${authRpm} rpm is too permissive for an auth endpoint — recommend ≤ 10 rpm to prevent brute force`);
    }

    if (minStandardRpm !== null && authRpm > minStandardRpm) {
      violations.push(`Auth endpoint "${id}": rate limit (${authRpm} rpm) is higher than the most restrictive standard GET endpoint (${minStandardRpm} rpm) — auth endpoints must be stricter`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'RL003', message: `${violations.length} auth endpoint(s) have insufficient rate limits`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'RL003', message: `All ${authEndpoints.length} auth endpoint(s) have appropriately strict rate limits` };
}
