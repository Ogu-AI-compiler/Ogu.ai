/**
 * Gate: no-todos (KW007)
 * Scans k8s-workload-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder values in a Kubernetes workload spec will be applied literally by
 * kubectl — the pod will fail to start with a confusing error rather than a
 * clear "spec is incomplete" message.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'k8s-workload-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'KW007',
      message: `${violations.length} TODO/FIXME marker(s) found in workload spec`,
      detail: {
        violations,
        hint: 'Fill in all placeholder values before applying this spec — kubectl will pass them to the API server literally',
      },
    };
  }

  return { pass: true, code: 'KW007', message: 'No TODO/FIXME markers in workload spec' };
}
