/**
 * Gate: no-todos (BW007)
 * Scans bg-worker-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder queue names or connection references will cause the worker to fail
 * at startup when it tries to connect to a queue called "TODO".
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'bg-worker-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'BW007',
      message: `${violations.length} TODO/FIXME marker(s) found in worker spec`,
      detail: {
        violations,
        hint: 'Fill in real queue names, connection env vars, and image tags — placeholder values cause startup failures',
      },
    };
  }

  return { pass: true, code: 'BW007', message: 'No TODO/FIXME markers in worker spec' };
}
