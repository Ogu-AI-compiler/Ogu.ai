/**
 * Gate: no-todos (DBB006)
 * Scans db-backup-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder destinations or schedule expressions will cause the backup job
 * to write to the wrong location or run at unintended times.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'db-backup-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'DBB006',
      message: `${violations.length} TODO/FIXME marker(s) found in db-backup-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real backup destinations, schedule expressions, and encryption keys before deploying',
      },
    };
  }

  return { pass: true, code: 'DBB006', message: 'No TODO/FIXME markers in db-backup-spec.json' };
}
