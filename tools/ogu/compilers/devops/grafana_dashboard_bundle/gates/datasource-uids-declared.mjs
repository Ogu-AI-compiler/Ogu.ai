/**
 * Gate: datasource-uids-declared (GD004)
 * Validates that all datasource UIDs referenced inside dashboard JSON files
 * are declared in the spec datasources list. Undeclared UIDs cause individual
 * panels to fail with "datasource not found" errors in Grafana, silently
 * breaking specific charts without failing the dashboard load.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec          = JSON.parse(readFileSync(join(dir, 'grafana-dashboard-spec.json'), 'utf8'));
  const declaredUids  = new Set((spec.datasources || []).map(d => d.uid).filter(Boolean));

  if (declaredUids.size === 0) {
    return { pass: true, code: 'GD004', message: 'No datasources declared — skipped', skipped: true };
  }

  const violations = [];

  for (const d of spec.dashboards) {
    if (!d.file || !existsSync(join(dir, d.file))) continue;
    const content = readFileSync(join(dir, d.file), 'utf8');
    const uids    = [...content.matchAll(/"uid"\s*:\s*"([^"]+)"/g)].map(m => m[1]);

    for (const uid of uids) {
      if (uid !== '-- Grafana --' && uid !== '${DS_PROMETHEUS}' && !declaredUids.has(uid) && !uid.startsWith('${')) {
        violations.push({ file: d.file, uid, reason: `Datasource UID "${uid}" is not in the declared datasources list` });
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'GD004',
      message: `${violations.length} undeclared datasource UID(s)`,
      detail: { violations, declaredUids: [...declaredUids], hint: 'Add missing UIDs to the datasources array in grafana-dashboard-spec.json' },
    };
  }

  return { pass: true, code: 'GD004', message: 'All datasource UIDs are declared' };
}
