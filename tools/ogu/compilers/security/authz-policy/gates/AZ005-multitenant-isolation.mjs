import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AZ005 — multitenant-isolation: multi-tenant resources must enforce tenant_id isolation in allow rules */
export async function run({ dir }) {
  const specPath = join(dir, 'authz-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'AZ005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'AZ005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // Only applies to multi-tenant features
  if (!spec.multi_tenant) {
    return { pass: true, code: 'AZ005', message: 'Feature is not multi-tenant — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.rules)) {
    return { pass: true, code: 'AZ005', message: 'No rules array — gate skipped', skipped: true };
  }

  const violations = [];

  for (const rule of spec.rules) {
    const id = rule.id || '?';
    const effect = String(rule.effect || '').toLowerCase();
    if (effect !== 'allow') continue;

    // Allow rules for tenant-scoped resources must enforce tenant isolation
    const isTenantScoped = rule.tenant_scoped === true ||
      (typeof rule.resource === 'string' && rule.resource.toLowerCase().includes('tenant'));

    if (!isTenantScoped) continue;

    // Must have a condition that checks tenant_id
    const conditions = rule.conditions || rule.condition || {};
    const conditionStr = JSON.stringify(conditions).toLowerCase();

    if (!conditionStr.includes('tenant_id') && !conditionStr.includes('tenant-id') && !conditionStr.includes('org_id')) {
      violations.push(`Rule "${id}": tenant-scoped allow rule is missing a tenant_id condition — cross-tenant access would be permitted`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'AZ005',
      message: `${violations.length} multi-tenant allow rule(s) missing tenant_id isolation condition`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'AZ005', message: 'Multi-tenant isolation conditions present in all tenant-scoped rules' };
}
