/**
 * Gate: hostnames-fqdn (DNS002)
 * Validates that every hostname in the DNS record list is a valid FQDN (including
 * wildcard domains like *.example.com). An invalid hostname is silently rejected
 * by the DNS provider API, leaving the record unregistered.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const FQDN = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dns-config-spec.json'), 'utf8'));
  const violations = spec.records
    .filter(r => !FQDN.test(r.hostname))
    .map(r => ({ hostname: r.hostname, reason: 'not a valid FQDN — must be a dot-separated hostname like api.example.com' }));

  if (violations.length) {
    return {
      pass: false, code: 'DNS002',
      message: `${violations.length} invalid FQDN(s)`,
      detail: {
        violations,
        hint: 'Valid FQDNs: api.example.com, *.example.com, mail.sub.example.co.uk. Single labels (localhost) are not valid FQDNs.',
      },
    };
  }

  return { pass: true, code: 'DNS002', message: `All ${spec.records.length} hostnames are valid FQDNs` };
}
