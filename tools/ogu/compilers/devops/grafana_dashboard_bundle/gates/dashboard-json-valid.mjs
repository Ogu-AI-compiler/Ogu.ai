/**
 * Gate: dashboard-json-valid (GD002)
 * Validates that every dashboard file referenced in the spec exists and is
 * valid JSON. Grafana silently skips dashboards with parse errors during
 * provisioning, leaving gaps in monitoring without any error indication.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'grafana-dashboard-spec.json'), 'utf8'));
  const violations = [];

  for (const d of spec.dashboards) {
    if (!d.file) {
      violations.push({ dashboard: '(unnamed)', reason: 'Dashboard entry is missing the file field' });
      continue;
    }
    const filePath = join(dir, d.file);
    if (!existsSync(filePath)) {
      violations.push({ file: d.file, reason: `Dashboard file not found at ${filePath}` });
      continue;
    }
    try {
      JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (e) {
      violations.push({ file: d.file, reason: `Dashboard file is not valid JSON: ${e.message}` });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'GD002',
      message: `${violations.length} dashboard JSON issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'GD002', message: `All ${spec.dashboards.length} dashboard JSON file(s) are valid` };
}
