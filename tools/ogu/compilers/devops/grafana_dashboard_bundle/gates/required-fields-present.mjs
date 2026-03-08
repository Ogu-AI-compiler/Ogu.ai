/**
 * Gate: required-fields-present (GD003)
 * Validates that every dashboard JSON file declares the required Grafana
 * fields: title (for display), panels (for content), and schemaVersion
 * (for compatibility). Dashboards missing these fields are either blank
 * or render with errors in the Grafana UI.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'grafana-dashboard-spec.json'), 'utf8'));
  const violations = [];

  for (const d of spec.dashboards) {
    if (!d.file || !existsSync(join(dir, d.file))) continue;
    const dash = JSON.parse(readFileSync(join(dir, d.file), 'utf8'));

    if (!dash.title)                 violations.push({ file: d.file, field: 'title',         reason: 'Dashboard is missing a title — it will display as "untitled" in Grafana' });
    if (!Array.isArray(dash.panels)) violations.push({ file: d.file, field: 'panels',        reason: 'Dashboard is missing a panels array — it will render as an empty dashboard' });
    if (!dash.schemaVersion)         violations.push({ file: d.file, field: 'schemaVersion', reason: 'Dashboard is missing schemaVersion — Grafana may reject or misrender it' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'GD003',
      message: `${violations.length} missing required field(s) across dashboard files`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'GD003', message: 'All dashboards have required fields (title, panels, schemaVersion)' };
}
