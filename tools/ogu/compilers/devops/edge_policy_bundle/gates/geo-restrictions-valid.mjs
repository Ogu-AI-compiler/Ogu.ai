/**
 * Gate: geo-restrictions-valid (EP005)
 * Validates geo restriction configuration. Country codes must be ISO 3166-1
 * alpha-2 format (two uppercase letters). Invalid codes are silently ignored
 * by most CDN/edge providers — the restriction appears configured but never
 * actually applies. Also prevents specifying both allowlist and denylist.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// ISO 3166-1 alpha-2 regex
const ISO2 = /^[A-Z]{2}$/;

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'edge-policy-spec.json'), 'utf8'));

  if (!spec.geoRestrictions) {
    return { pass: true, code: 'EP005', message: 'No geo restrictions — skipping', skipped: true };
  }

  const { allowlist, denylist } = spec.geoRestrictions;
  const violations = [];

  if (allowlist && denylist) {
    violations.push({ field: 'geoRestrictions', reason: 'Cannot specify both allowlist and denylist — choose one mode', hint: 'Use allowlist to permit only listed countries, or denylist to block listed countries' });
  }

  for (const code of (allowlist || [])) {
    if (!ISO2.test(code)) {
      violations.push({ field: 'geoRestrictions.allowlist', code, reason: `"${code}" is not a valid ISO 3166-1 alpha-2 code — use two uppercase letters (e.g. "US", "GB")` });
    }
  }
  for (const code of (denylist || [])) {
    if (!ISO2.test(code)) {
      violations.push({ field: 'geoRestrictions.denylist', code, reason: `"${code}" is not a valid ISO 3166-1 alpha-2 code — use two uppercase letters (e.g. "US", "GB")` });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'EP005',
      message: `${violations.length} geo restriction error(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'EP005', message: 'Geo restrictions valid' };
}
