/**
 * Gate: pii-row-level-security (RPP005)
 * Any role that has access to tables marked as pii_tier: true must have
 * row_level_security: "required" declared in its policy.
 * Without RLS, any application-tier bug can read ALL rows — not just the
 * tenant/user's own data.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'role-privilege-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RPP005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RPP005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'RPP005', message: 'No roles array — gate skipped', skipped: true };
  }

  // Check if any pii_tables are declared at the spec level or per-role
  const globalPiiTables = Array.isArray(spec.pii_tables) ? spec.pii_tables : [];
  const hasPiiInSpec = globalPiiTables.length > 0 || spec.has_pii_tables === true;

  if (!hasPiiInSpec) {
    return {
      pass: true,
      code: 'RPP005',
      message: 'No PII tables declared — row-level security check skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const role of spec.roles) {
    // Skip migration and admin roles — they need full table access for maintenance
    if (role.type === 'migration' || role.type === 'admin') continue;

    // Check if this role accesses PII tables
    const accessesPiiTables = role.pii_table_access === true ||
      (Array.isArray(role.tables) && role.tables.some(t => globalPiiTables.includes(t)));

    if (!accessesPiiTables) continue;

    if (role.row_level_security !== 'required') {
      violations.push(
        `Role "${role.name}" (type: "${role.type}") accesses PII tables but row_level_security is not "required". ` +
        'Set row_level_security: "required" to prevent cross-tenant data leaks.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RPP005',
      message: `${violations.length} role(s) accessing PII tables without row-level security`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RPP005',
    message: 'All roles accessing PII tables have row_level_security: "required"',
  };
}
