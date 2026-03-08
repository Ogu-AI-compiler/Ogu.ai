/**
 * Gate: panel-ids-unique (GD005)
 * Validates that all panel IDs within each dashboard are unique. Duplicate
 * panel IDs cause Grafana to render one panel in multiple grid positions,
 * showing the same chart twice while other panels disappear entirely.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'grafana-dashboard-spec.json'), 'utf8'));
  const violations = [];

  for (const d of spec.dashboards) {
    if (!d.file || !existsSync(join(dir, d.file))) continue;
    const dash = JSON.parse(readFileSync(join(dir, d.file), 'utf8'));
    const seen = new Map();
    const dupes = [];

    for (const panel of (dash.panels || [])) {
      if (panel.id !== undefined) {
        if (seen.has(panel.id)) {
          dupes.push(panel.id);
        } else {
          seen.set(panel.id, true);
        }
      }
    }

    if (dupes.length) {
      violations.push({ file: d.file, duplicateIds: [...new Set(dupes)], reason: `Duplicate panel IDs cause panels to overlap or disappear in Grafana` });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'GD005',
      message: `${violations.length} dashboard(s) with duplicate panel IDs`,
      detail: { violations, hint: 'Assign a unique integer id to each panel within a dashboard' },
    };
  }

  return { pass: true, code: 'GD005', message: 'All panel IDs are unique' };
}
