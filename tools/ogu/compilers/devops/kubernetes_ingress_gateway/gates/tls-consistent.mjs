/**
 * Gate: tls-consistent (KI004)
 * When TLS is configured, validates that every TLS host appears in at least one
 * ingress rule and that every TLS entry has a secretName. A TLS entry for a host
 * with no matching rule is unreachable — the certificate will be served but
 * traffic to that host will return 404.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'k8s-ingress-spec.json'), 'utf8'));

  if (!spec.tls || spec.tls.length === 0) {
    return { pass: true, code: 'KI004', message: 'No TLS config — skipped', skipped: true };
  }

  const ruleHosts  = new Set(spec.rules.map(r => r.host).filter(Boolean));
  const violations = [];

  for (const tls of spec.tls) {
    if (!tls.secretName) {
      violations.push({ entry: JSON.stringify(tls), reason: 'TLS entry missing secretName — the ingress controller cannot find the certificate' });
    }
    if (!Array.isArray(tls.hosts) || tls.hosts.length === 0) {
      violations.push({ secretName: tls.secretName, reason: 'TLS entry has no hosts — the certificate will never be served' });
      continue;
    }
    for (const host of tls.hosts) {
      if (!ruleHosts.has(host)) {
        violations.push({
          secretName: tls.secretName,
          host,
          reason: `TLS host "${host}" has no matching rule — the certificate will be served but requests return 404`,
          hint:   `Add a rule for host: "${host}" or remove it from this TLS entry`,
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KI004',
      message: `${violations.length} TLS inconsistency/inconsistencies`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'KI004', message: 'TLS configuration is consistent with route hosts' };
}
