import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** RL004 — burst-and-sustained-defined: rate limits must distinguish burst and sustained rates */
export async function run({ dir }) {
  const specPath = join(dir, 'rate-limit-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'RL004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'RL004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.endpoints)) return { pass: true, code: 'RL004', message: 'No endpoints — gate skipped', skipped: true };

  // Only check non-internal endpoints
  const checkedEndpoints = spec.endpoints.filter(ep => {
    const sens = String(ep.sensitivity || '').toLowerCase();
    return sens !== 'internal' && sens !== 'm2m' && sens !== 'service';
  });

  if (checkedEndpoints.length === 0) return { pass: true, code: 'RL004', message: 'Only internal endpoints — gate skipped', skipped: true };

  const violations = [];
  for (const ep of checkedEndpoints) {
    const id = `${ep.method} ${ep.path}`;
    const hasBurst = ep.burst !== undefined || ep.burst_rpm !== undefined || ep.burst_rps !== undefined ||
      (ep.limits && ep.limits.burst !== undefined);
    const hasSustained = ep.sustained !== undefined || ep.per_ip_rpm !== undefined || ep.rpm !== undefined ||
      (ep.limits && (ep.limits.sustained !== undefined || ep.limits.rpm !== undefined));

    if (!hasBurst && !hasSustained) {
      violations.push(`Endpoint "${id}": no rate limit declared — must define at least a sustained limit (rpm or per_ip_rpm)`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'RL004', message: `${violations.length} endpoint(s) have no rate limits defined`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'RL004', message: `Rate limits defined for all ${checkedEndpoints.length} non-internal endpoint(s)` };
}
