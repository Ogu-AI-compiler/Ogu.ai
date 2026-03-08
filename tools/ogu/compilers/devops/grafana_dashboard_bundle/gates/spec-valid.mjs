/**
 * Gate: spec-valid (GD001)
 * Validates that grafana-dashboard-spec.json exists, is valid JSON, and declares
 * a non-empty dashboards array. Without this, no dashboards are provisioned
 * and the Grafana instance starts with no monitoring visibility.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'grafana-dashboard-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false, code: 'GD001',
      message: 'grafana-dashboard-spec.json not found',
      detail: { searched: specPath, hint: 'Create grafana-dashboard-spec.json with a dashboards array and optional datasources array' },
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'GD001', message: `grafana-dashboard-spec.json is not valid JSON: ${e.message}` };
  }

  if (!Array.isArray(spec.dashboards) || spec.dashboards.length === 0) {
    return {
      pass: false, code: 'GD001',
      message: 'dashboards must be a non-empty array',
      detail: {
        received: spec.dashboards,
        hint:     'Required structure: { dashboards: [{ file: "dashboard.json", uid: "..." }], datasources: [{ uid, name }] }',
      },
    };
  }

  return { pass: true, code: 'GD001', message: `grafana-dashboard-spec.json valid — ${spec.dashboards.length} dashboard(s)` };
}
