/**
 * Gate: no-todos (CT006)
 * Scans cost-tagging-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder tag keys or allowed values will be applied to cloud resources,
 * generating invalid tags that cloud billing systems will silently ignore.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'cost-tagging-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'CT006',
      message: `${violations.length} TODO/FIXME marker(s) found in cost-tagging-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real tag keys, allowed values, and cost center names before applying the tagging policy',
      },
    };
  }

  return { pass: true, code: 'CT006', message: 'No TODO/FIXME markers in cost-tagging-spec.json' };
}
