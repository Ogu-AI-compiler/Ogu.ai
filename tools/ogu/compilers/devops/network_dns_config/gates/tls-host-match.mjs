/**
 * Gate: tls-host-match (DNS006)
 * When TLS certificates are declared in spec.tls, validates that every TLS hostname
 * corresponds to a DNS record in the same spec. A certificate for a hostname with
 * no DNS record is unreachable — the certificate will be issued but traffic can
 * never reach the server to be served.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'dns-config-spec.json'), 'utf8'));

  if (!spec.tls || spec.tls.length === 0) {
    return { pass: true, code: 'DNS006', message: 'No TLS config — skipped', skipped: true };
  }

  const dnsHostnames = new Set(spec.records.map(r => r.hostname));
  const violations   = [];

  for (const tls of spec.tls) {
    if (!tls.hostname) {
      violations.push({ entry: JSON.stringify(tls), reason: 'TLS entry missing hostname' });
      continue;
    }
    if (!dnsHostnames.has(tls.hostname)) {
      violations.push({
        hostname: tls.hostname,
        reason:   `TLS hostname "${tls.hostname}" has no corresponding DNS record`,
        hint:     `Add a DNS record for ${tls.hostname}, or remove it from the tls array`,
      });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DNS006',
      message: `${violations.length} TLS/DNS hostname mismatch(es)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DNS006', message: 'All TLS hostnames have corresponding DNS records' };
}
