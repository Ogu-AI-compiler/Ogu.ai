import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CT003 — ttl-declared
 * Every cache family must declare either:
 * - ttl: number (seconds) — explicit expiration
 * - noExpiry: true — deliberately never expires (must justify with a comment in spec)
 * No implicit "no TTL" allowed.
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'cache-topology-spec.json'), 'utf8'));
  const violations = [];

  for (const f of spec.families) {
    const hasTtl = typeof f.ttl === 'number' && f.ttl > 0;
    const hasNoExpiry = f.noExpiry === true;

    if (!hasTtl && !hasNoExpiry) {
      violations.push(`Cache family "${f.name}" (${f.namespace}) has neither ttl nor noExpiry:true`);
    }

    if (hasTtl && hasNoExpiry) {
      violations.push(`Cache family "${f.name}" cannot have both ttl and noExpiry:true`);
    }

    if (hasNoExpiry && !f.noExpiryReason) {
      violations.push(`Cache family "${f.name}" uses noExpiry:true but no noExpiryReason is documented`);
    }

    // Sanity check: TTL of 0 seconds is effectively disabled, which is confusing
    if (f.ttl === 0) {
      violations.push(`Cache family "${f.name}" has ttl:0 — use noExpiry:true if intentional, or set a positive value`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT003',
      message: `${violations.length} cache family/families with missing TTL declaration`,
      detail: violations.join('\n') + '\n\nAdd ttl: 300 (seconds) or noExpiry: true with noExpiryReason: "..."'
    };
  }

  const withTtl = spec.families.filter(f => f.ttl).length;
  const withNoExpiry = spec.families.filter(f => f.noExpiry).length;

  return {
    pass: true, code: 'CT003',
    message: `TTL policy declared for all families (${withTtl} with TTL, ${withNoExpiry} no-expiry)`
  };
}
