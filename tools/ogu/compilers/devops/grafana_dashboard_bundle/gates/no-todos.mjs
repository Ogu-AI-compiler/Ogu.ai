/**
 * Gate: no-todos (GD006)
 * Scans grafana-dashboard-spec.json for TODO, FIXME, HACK, and PLACEHOLDER
 * markers. Placeholder datasource UIDs or dashboard file paths will cause
 * Grafana provisioning to fail silently, leaving blank dashboards.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'grafana-dashboard-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'GD006',
      message: `${violations.length} TODO/FIXME marker(s) found in grafana-dashboard-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real datasource UIDs and dashboard file paths — placeholder values cause silent provisioning failures',
      },
    };
  }

  return { pass: true, code: 'GD006', message: 'No TODO/FIXME markers in grafana-dashboard-spec.json' };
}
