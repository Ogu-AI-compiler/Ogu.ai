/**
 * Gate: no-todos (SS006)
 * Scans security-scan-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder scanner types or severity thresholds will result in scanners that
 * either fail to run or never block the pipeline.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'security-scan-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'SS006',
      message: `${violations.length} TODO/FIXME marker(s) found in security-scan-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real scanner types, severity thresholds, and output paths before deploying the security pipeline',
      },
    };
  }

  return { pass: true, code: 'SS006', message: 'No TODO/FIXME markers in security-scan-spec.json' };
}
