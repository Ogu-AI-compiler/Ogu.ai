/**
 * Gate: no-todos (DNS007)
 * Scans dns-config-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * A placeholder hostname or target in a DNS record causes a failed DNS lookup for
 * all traffic to that hostname — the service becomes unreachable.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'dns-config-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'DNS007',
      message: `${violations.length} TODO/FIXME marker(s) found in DNS config spec`,
      detail: {
        violations,
        hint: 'Fill in real hostnames and targets — placeholder values become literal DNS records that fail to resolve',
      },
    };
  }

  return { pass: true, code: 'DNS007', message: 'No TODO/FIXME markers in DNS config spec' };
}
