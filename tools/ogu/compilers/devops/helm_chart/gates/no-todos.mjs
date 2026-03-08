/**
 * Gate: no-todos (HC007)
 * Scans helm-chart-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder chart names, versions, or maintainer entries will produce
 * invalid Chart.yaml files that fail helm lint.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'helm-chart-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'HC007',
      message: `${violations.length} TODO/FIXME marker(s) found in helm-chart-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real chart names, versions, maintainer emails, and image tags — placeholder values produce invalid Chart.yaml output',
      },
    };
  }

  return { pass: true, code: 'HC007', message: 'No TODO/FIXME markers in helm-chart-spec.json' };
}
