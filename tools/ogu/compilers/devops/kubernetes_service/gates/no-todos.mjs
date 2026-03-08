/**
 * Gate: no-todos (KS006)
 * Scans k8s-service-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * A Service spec with unresolved placeholders will either be rejected by the API
 * server or silently create a misconfigured service that routes to no pods.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'k8s-service-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'KS006',
      message: `${violations.length} TODO/FIXME marker(s) found in service spec`,
      detail: {
        violations,
        hint: 'Resolve all placeholder values — the API server will attempt to create a Service with the placeholder values as-is',
      },
    };
  }

  return { pass: true, code: 'KS006', message: 'No TODO/FIXME markers in service spec' };
}
