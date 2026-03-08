/**
 * Gate: no-todos (PC006)
 * Scans probe-config-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * A placeholder port number or path in a probe handler will cause the kubelet to
 * fail the probe immediately — the container will be restarted on every cycle.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'probe-config-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'PC006',
      message: `${violations.length} TODO/FIXME marker(s) found in probe config spec`,
      detail: {
        violations,
        hint: 'Fill in real ports and paths — a placeholder probe handler causes immediate probe failure and pod restart loops',
      },
    };
  }

  return { pass: true, code: 'PC006', message: 'No TODO/FIXME markers in probe config spec' };
}
