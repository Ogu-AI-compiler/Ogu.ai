/**
 * Gate: no-todos (PR006)
 * Scans prometheus-rules-spec.json for TODO, FIXME, HACK, and PLACEHOLDER
 * markers. Placeholder PromQL expressions will parse but evaluate to nothing,
 * meaning the alert will never fire — silent monitoring failure.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'prometheus-rules-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'PR006',
      message: `${violations.length} TODO/FIXME marker(s) found in prometheus-rules-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real PromQL expressions, severity labels, and runbook URLs — placeholder values result in silent monitoring failure',
      },
    };
  }

  return { pass: true, code: 'PR006', message: 'No TODO/FIXME markers in prometheus-rules-spec.json' };
}
