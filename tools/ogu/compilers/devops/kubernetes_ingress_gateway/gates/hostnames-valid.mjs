/**
 * Gate: hostnames-valid (KI003)
 * Validates that all host fields in ingress rules are valid FQDNs (including wildcard
 * certificates like *.example.com). Invalid or duplicate hostnames cause the ingress
 * controller to skip the rule, sending traffic to a different backend or returning 404.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const FQDN_PATTERN = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'k8s-ingress-spec.json'), 'utf8'));
  const seenHosts  = new Set();
  const violations = [];

  for (const rule of spec.rules) {
    if (!rule.host) continue;
    if (!FQDN_PATTERN.test(rule.host)) {
      violations.push({ host: rule.host, reason: 'not a valid FQDN — must be a dot-separated hostname (e.g. api.example.com or *.example.com)' });
    }
    if (seenHosts.has(rule.host)) {
      violations.push({ host: rule.host, reason: 'duplicate host — only the first matching rule will be used' });
    }
    seenHosts.add(rule.host);
  }

  if (violations.length) {
    return {
      pass: false, code: 'KI003',
      message: `${violations.length} hostname issue(s)`,
      detail: { violations, hint: 'Use valid FQDNs like api.example.com or *.example.com. IP addresses are not valid Ingress hosts.' },
    };
  }

  return { pass: true, code: 'KI003', message: `All ${seenHosts.size} hostname(s) are valid FQDNs` };
}
