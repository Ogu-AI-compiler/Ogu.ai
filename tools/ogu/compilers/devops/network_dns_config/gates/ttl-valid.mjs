/**
 * Gate: ttl-valid (DNS005)
 * Validates that all TTL values are within the org-configured bounds. A TTL below the
 * minimum causes excessive DNS traffic to authoritative servers. A TTL above the
 * maximum means DNS changes take too long to propagate — a deployment blocker during
 * incidents or migrations.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_MIN_TTL = 60;
const DEFAULT_MAX_TTL = 86400;

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dns-config-spec.json'), 'utf8'));
  const minTtl     = spec.ttlPolicy?.min || DEFAULT_MIN_TTL;
  const maxTtl     = spec.ttlPolicy?.max || DEFAULT_MAX_TTL;
  const violations = [];

  for (const r of spec.records) {
    if (r.ttl === undefined) continue;
    if (!Number.isInteger(r.ttl) || r.ttl < minTtl || r.ttl > maxTtl) {
      violations.push({
        hostname: r.hostname,
        ttl:      r.ttl,
        reason:   `TTL ${r.ttl}s is outside the allowed range [${minTtl}s, ${maxTtl}s]`,
        hint:     `Set TTL between ${minTtl} (1 minute) and ${maxTtl} (24 hours). Use low TTL (60–300s) during migrations, high TTL (3600s+) for stable records.`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DNS005',
      message: `${violations.length} TTL violation(s)`,
      detail: { violations, policy: { min: minTtl, max: maxTtl } },
    };
  }

  return {
    pass: true, code: 'DNS005',
    message: `All TTL values are within policy bounds [${minTtl}s, ${maxTtl}s]`,
  };
}
