/**
 * Gate: no-todos (SB006)
 * Scans secret-bundle-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * A secret bundle with placeholder entries will cause runtime lookup failures —
 * the secret manager has no entry at a placeholder path.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'secret-bundle-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'SB006',
      message: `${violations.length} TODO/FIXME marker(s) found in secret bundle spec`,
      detail: {
        violations,
        hint: 'Fill in real secret paths and envKey values before shipping — placeholder entries will fail at runtime secret lookup',
      },
    };
  }

  return { pass: true, code: 'SB006', message: 'No TODO/FIXME markers in secret bundle spec' };
}
