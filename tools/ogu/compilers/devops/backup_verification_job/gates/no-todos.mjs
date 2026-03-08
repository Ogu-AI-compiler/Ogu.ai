/**
 * Gate: no-todos (BV006)
 * Scans backup-verify-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder backup sources or restore targets will cause the verification job
 * to restore from the wrong backup or write results to the wrong location.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'backup-verify-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'BV006',
      message: `${violations.length} TODO/FIXME marker(s) found in backup-verify-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real backup sources, restore targets, and verification queries before deploying',
      },
    };
  }

  return { pass: true, code: 'BV006', message: 'No TODO/FIXME markers in backup-verify-spec.json' };
}
