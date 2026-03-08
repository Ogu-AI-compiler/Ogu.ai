/**
 * Gate: no-todos (DS006)
 * Scans data-seed-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder database names or target environments will cause the seed job to
 * connect to the wrong database or run in the wrong environment.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'data-seed-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'DS006',
      message: `${violations.length} TODO/FIXME marker(s) found in data-seed-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real database names, target environments, and script paths — placeholder values connect to the wrong database',
      },
    };
  }

  return { pass: true, code: 'DS006', message: 'No TODO/FIXME markers in data-seed-spec.json' };
}
