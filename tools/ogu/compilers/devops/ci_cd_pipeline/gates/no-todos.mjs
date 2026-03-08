/**
 * Gate: no-todos (CIP007)
 * Scans ci-cd-spec.json for TODO, FIXME, HACK, PLACEHOLDER, and XXX markers.
 * A pipeline spec with placeholder markers is not production-ready — it will
 * likely malfunction when the CI platform attempts to execute the unresolved step.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'ci-cd-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'CIP007',
      message: `${violations.length} TODO/FIXME marker(s) found in pipeline spec`,
      detail: {
        violations,
        hint: 'Resolve all placeholder markers — the CI platform will attempt to execute them literally',
      },
    };
  }

  return { pass: true, code: 'CIP007', message: 'No TODO/FIXME markers in pipeline spec' };
}
