import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** EK006 — rotation-interval-reasonable: key rotation intervals must be within acceptable ranges */
export async function run({ dir }) {
  const specPath = join(dir, 'encryption-key-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'EK006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'EK006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.keys) || spec.keys.length === 0) {
    return { pass: true, code: 'EK006', message: 'No keys — gate skipped', skipped: true };
  }

  // Maximum rotation intervals by purpose/type
  const MAX_BY_PURPOSE = {
    'signing': 365,
    'jwt': 90,
    'token': 90,
    'database': 365,
    'at-rest': 365,
    'storage': 365,
    'transit': 730, // TLS certs can last up to 2 years
    'master': 365,
    'kek': 365, // key-encryption key
  };

  const violations = [];

  for (const key of spec.keys) {
    const id = key.id || '?';
    const days = key.rotation_days;

    if (typeof days !== 'number') continue;

    // Absolute upper bound: no key should rotate less frequently than once per 2 years
    if (days > 730) {
      violations.push(`Key "${id}": rotation_days=${days} exceeds maximum of 730 days (2 years) — shorten the rotation interval`);
      continue;
    }

    // Check purpose-specific limits
    const purposeLower = String(key.purpose || '').toLowerCase();
    for (const [keyword, max] of Object.entries(MAX_BY_PURPOSE)) {
      if (purposeLower.includes(keyword) && days > max) {
        violations.push(`Key "${id}" (purpose: "${key.purpose}"): rotation_days=${days} exceeds ${max}-day maximum for ${keyword} keys`);
        break;
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'EK006',
      message: `${violations.length} key(s) have unreasonably long rotation intervals`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'EK006', message: `All ${spec.keys.length} key(s) have reasonable rotation intervals` };
}
