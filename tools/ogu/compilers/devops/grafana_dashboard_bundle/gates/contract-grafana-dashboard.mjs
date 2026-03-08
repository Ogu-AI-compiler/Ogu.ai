/**
 * Gate: contract-grafana-dashboard (GD007)
 * Validates that the grafana dashboard bundle satisfies the contract:
 * datasources must be declared with uid and type, every dashboard must have
 * a UID (for idempotent Grafana API provisioning), and dashboards must have
 * tags (for organising dashboards by service and environment).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'grafana-dashboard-spec.json'), 'utf8'));
  const violations = [];

  // At least one datasource must be declared so panel datasource UIDs can be validated
  if (!spec.datasources || spec.datasources.length === 0) {
    violations.push({
      rule:   'datasources-required',
      reason: 'No datasources declared — datasource UIDs in dashboards cannot be validated',
      hint:   'Add a datasources array so panel UID references can be verified',
    });
  }

  // Every datasource entry must have uid and type
  for (const ds of (spec.datasources || [])) {
    if (!ds.uid)  violations.push({ rule: 'datasource-uid-required',  datasource: JSON.stringify(ds), reason: 'Datasource is missing a uid field' });
    if (!ds.type) violations.push({ rule: 'datasource-type-required', datasource: ds.uid || '?',       reason: `Datasource "${ds.uid || '?'}" is missing a type field (e.g. prometheus, loki, elasticsearch)` });
  }

  // Each compiled dashboard JSON should have a uid and tags
  for (const d of spec.dashboards) {
    if (!d.file) continue;
    const filePath = join(dir, d.file);
    if (!existsSync(filePath)) continue;
    let dash;
    try { dash = JSON.parse(readFileSync(filePath, 'utf8')); } catch (_) { continue; }

    if (!dash.uid) {
      violations.push({ rule: 'dashboard-uid-required', file: d.file, reason: 'Dashboard is missing a "uid" field — dashboards without UIDs cannot be idempotently provisioned via Grafana API' });
    }
    if (!dash.tags || dash.tags.length === 0) {
      violations.push({ rule: 'dashboard-tags-required', file: d.file, reason: 'Dashboard has no tags — use tags to organise dashboards (e.g. ["service:api", "env:production"])' });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'GD007',
      message: `${violations.length} contract violation(s) in grafana dashboard bundle`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'GD007',
    message: `Grafana dashboard bundle contract satisfied — ${spec.dashboards.length} dashboard(s), ${(spec.datasources || []).length} datasource(s)`,
  };
}
