/**
 * Gate: no-todos (KI006)
 * Scans k8s-ingress-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * A placeholder in an ingress spec becomes a literal hostname or path rule that
 * will never resolve to any service — traffic silently returns 404 or 503.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'k8s-ingress-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'KI006',
      message: `${violations.length} TODO/FIXME marker(s) found in ingress spec`,
      detail: {
        violations,
        hint: 'Fill in real hostnames and backend service names — placeholder values become literal ingress rules',
      },
    };
  }

  return { pass: true, code: 'KI006', message: 'No TODO/FIXME markers in ingress spec' };
}
