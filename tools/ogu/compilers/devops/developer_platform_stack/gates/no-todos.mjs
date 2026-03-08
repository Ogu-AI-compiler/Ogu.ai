/**
 * Gate: no-todos (DP006)
 * Scans dev-platform-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder component types or tool names will cause the platform spec to
 * reference tools that do not exist or are not configured.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'dev-platform-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'DP006',
      message: `${violations.length} TODO/FIXME marker(s) found in dev-platform-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real tool names, golden path steps, and component URLs before applying the platform spec',
      },
    };
  }

  return { pass: true, code: 'DP006', message: 'No TODO/FIXME markers in dev-platform-spec.json' };
}
