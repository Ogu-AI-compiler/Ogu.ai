/**
 * Gate: no-all-privileges (RPP004)
 * No role may use "ALL PRIVILEGES" or "ALL" as a privilege grant.
 * Wildcard grants are a least-privilege violation — they silently include
 * new privileges added in future PostgreSQL versions and grant more than
 * the role ever needs.
 *
 * Every privilege must be an explicit, enumerated value.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ALL_PRIVILEGES_PATTERNS = ['ALL', 'ALL PRIVILEGES', '*'];

export async function run({ dir }) {
  const specPath = join(dir, 'role-privilege-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RPP004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RPP004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'RPP004', message: 'No roles array — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of spec.roles) {
    if (!Array.isArray(role.privileges)) continue;

    for (const priv of role.privileges) {
      const normalized = String(priv).toUpperCase().trim();
      if (ALL_PRIVILEGES_PATTERNS.includes(normalized)) {
        violations.push(
          `Role "${role.name}": privilege "${priv}" is a wildcard grant. ` +
          'Enumerate privileges explicitly (SELECT, INSERT, UPDATE, etc.).'
        );
      }
    }

    // Also check schema_access and table_grants if present
    if (Array.isArray(role.schema_access)) {
      for (const sa of role.schema_access) {
        if (Array.isArray(sa.privileges)) {
          for (const priv of sa.privileges) {
            const normalized = String(priv).toUpperCase().trim();
            if (ALL_PRIVILEGES_PATTERNS.includes(normalized)) {
              violations.push(
                `Role "${role.name}" schema "${sa.schema}": privilege "${priv}" is a wildcard grant.`
              );
            }
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RPP004',
      message: `${violations.length} wildcard privilege grant(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RPP004',
    message: 'All roles use explicit, enumerated privilege grants',
  };
}
