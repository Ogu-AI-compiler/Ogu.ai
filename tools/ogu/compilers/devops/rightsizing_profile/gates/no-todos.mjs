/**
 * Gate: no-todos (RS006)
 * Scans rightsizing-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder CPU/memory values produce invalid resource specs that Kubernetes
 * rejects at admission time with a parse error.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'rightsizing-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'RS006',
      message: `${violations.length} TODO/FIXME marker(s) found in rightsizing-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real CPU/memory values — placeholder resource values are rejected by Kubernetes at pod admission',
      },
    };
  }

  return { pass: true, code: 'RS006', message: 'No TODO/FIXME markers in rightsizing-spec.json' };
}
