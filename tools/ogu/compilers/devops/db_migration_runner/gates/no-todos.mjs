/**
 * Gate: no-todos (MR006)
 * Scans db-migration-runner-spec.json for TODO, FIXME, HACK, and PLACEHOLDER
 * markers. Placeholder migration directories or commands will cause the runner
 * to fail to find migration files or execute an unknown command.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'db-migration-runner-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'MR006',
      message: `${violations.length} TODO/FIXME marker(s) found in db-migration-runner-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real migration commands, directory paths, and rollback commands before deploying',
      },
    };
  }

  return { pass: true, code: 'MR006', message: 'No TODO/FIXME markers in db-migration-runner-spec.json' };
}
