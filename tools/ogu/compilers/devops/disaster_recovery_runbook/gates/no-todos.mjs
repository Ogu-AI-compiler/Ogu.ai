/**
 * Gate: no-todos (DR007)
 * Scans dr-runbook-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * A DR runbook with placeholders is not executable — during an actual disaster,
 * "TODO: insert RTO here" provides no guidance to the on-call engineer.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'dr-runbook-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'DR007',
      message: `${violations.length} TODO/FIXME marker(s) found in dr-runbook-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real RTO/RPO values, scenario steps, and contact information — a runbook with placeholders cannot be executed during a real disaster',
      },
    };
  }

  return { pass: true, code: 'DR007', message: 'No TODO/FIXME markers in dr-runbook-spec.json' };
}
