import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RL002 — public-endpoints-have-limits: every public endpoint must have per-IP rate limits */
export async function run({ dir }) {
  const specPath = join(dir, 'rate-limit-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'RL002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'RL002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.endpoints)) return { pass: true, code: 'RL002', message: 'No endpoints — gate skipped', skipped: true };

  const publicEndpoints = spec.endpoints.filter(ep => {
    const sens = String(ep.sensitivity || '').toLowerCase();
    return sens === 'public' || sens === 'unauthenticated';
  });
  if (publicEndpoints.length === 0) return { pass: true, code: 'RL002', message: 'No public endpoints — gate skipped', skipped: true };

  const violations = [];
  for (const ep of publicEndpoints) {
    const id = `${ep.method} ${ep.path}`;
    const hasPerIpLimit = ep.per_ip_rpm !== undefined || ep.per_ip_rps !== undefined || ep.per_ip !== undefined ||
      (ep.limits && (ep.limits.per_ip !== undefined || ep.limits.per_ip_rpm !== undefined));
    if (!hasPerIpLimit) {
      violations.push(`Endpoint "${id}" (public): must declare a per-IP rate limit (per_ip_rpm or per_ip_rps)`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'RL002', message: `${violations.length} public endpoint(s) missing per-IP rate limit`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'RL002', message: `Per-IP limits set for all ${publicEndpoints.length} public endpoint(s)` };
}
