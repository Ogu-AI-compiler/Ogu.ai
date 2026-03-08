/**
 * Gate: no-todos (CP006)
 * Scans connection-pool-spec.json for TODO, FIXME, HACK, and PLACEHOLDER
 * markers. Placeholder host names or pooler types will cause the connection
 * pool to start but immediately fail to connect to any database.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'connection-pool-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'CP006',
      message: `${violations.length} TODO/FIXME marker(s) found in connection-pool-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real host names, pool sizes, and auth types — placeholder values cause the connection pool to fail at startup',
      },
    };
  }

  return { pass: true, code: 'CP006', message: 'No TODO/FIXME markers in connection-pool-spec.json' };
}
