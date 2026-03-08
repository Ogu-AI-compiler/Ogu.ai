/**
 * Gate: contract-dns-config (DNS008)
 * Enforces the network_dns_config runtime contract: an environment field identifies
 * which environment these records target, an owner is required for DNS change
 * accountability, and all records should have explicit TTLs (relying on provider
 * defaults makes TTL management non-deterministic across environments).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dns-config-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.environment) {
    violations.push({
      rule:   'environment-required',
      reason: 'No environment field — DNS records must be scoped to a specific environment (staging, production)',
      hint:   'Add environment: "production" (or "staging", "dev") to indicate which environment these records target',
    });
  }

  if (!spec.owner) {
    violations.push({
      rule:   'owner-required',
      reason: 'No owner field — DNS changes need an accountable team or person',
      hint:   'Add owner: "platform-team" for operational accountability',
    });
  }

  const noTtl = spec.records.filter(r => r.ttl === undefined);
  if (noTtl.length > 0) {
    violations.push({
      rule:      'explicit-ttl-recommended',
      records:   noTtl.map(r => r.hostname),
      reason:    `${noTtl.length} record(s) have no TTL — provider defaults vary and make migration planning unpredictable`,
      hint:      'Add explicit TTL to every record. Use 300s for records that may change, 3600s+ for stable records.',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DNS008',
      message: `${violations.length} contract violation(s)`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'DNS008',
    message: `DNS config contract satisfied — ${spec.records.length} records, env: ${spec.environment}`,
  };
}
