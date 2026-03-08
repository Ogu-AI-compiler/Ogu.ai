/**
 * Gate: no-todos (EP006)
 * Scans edge-policy-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder rate limits or WAF rules will either have no effect or block
 * all traffic unexpectedly.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'edge-policy-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'EP006',
      message: `${violations.length} TODO/FIXME marker(s) found in edge-policy-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real rate limits, WAF match expressions, and allowed origins before deploying',
      },
    };
  }

  return { pass: true, code: 'EP006', message: 'No TODO/FIXME markers in edge-policy-spec.json' };
}
