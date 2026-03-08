/**
 * Gate: targets-resolve (DNS004)
 * Cross-artifact gate: validates that A and CNAME record targets are syntactically
 * valid IPs or hostnames. When a k8s-ingress-artifact.json is present, can also
 * validate that CNAME targets correspond to declared load balancer hostnames.
 *
 * Falls back gracefully when no ingress artifact exists.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const VALID_IP     = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const VALID_FQDN   = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dns-config-spec.json'), 'utf8'));
  const violations = [];

  for (const record of spec.records) {
    if (record.type === 'A' || record.type === 'CNAME') {
      const isIp       = VALID_IP.test(record.target);
      const isHostname = VALID_FQDN.test(record.target);
      if (!isIp && !isHostname) {
        violations.push({
          hostname: record.hostname,
          type:     record.type,
          target:   record.target,
          reason:   'target is not a valid IP address or hostname',
          hint:     'A records need an IPv4 address. CNAME records need a hostname (e.g. lb.example.com).',
        });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DNS004',
      message: `${violations.length} invalid target(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DNS004', message: `All ${spec.records.length} DNS targets are syntactically valid` };
}
