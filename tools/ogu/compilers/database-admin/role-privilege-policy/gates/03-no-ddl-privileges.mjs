/**
 * Gate: no-ddl-privileges (RPP003)
 * Application and analytics roles must not have DDL privileges: DROP, TRUNCATE,
 * ALTER, CREATE. These are structural operations that can destroy or modify
 * table definitions. Only migration roles need DDL access.
 *
 * DDL privileges on application roles are a common source of accidental data
 * loss (e.g., ORM running a DROP TABLE in a bug, or a rogue UPDATE TRUNCATE).
 *
 * Escape hatch: // @ddl-ok — for roles that legitimately need DDL (document why)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DDL_PRIVILEGES = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
const ROLES_THAT_MAY_HAVE_DDL = ['migration', 'admin'];

export async function run({ dir }) {
  const specPath = join(dir, 'role-privilege-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RPP003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RPP003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'RPP003', message: 'No roles array — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of spec.roles) {
    if (ROLES_THAT_MAY_HAVE_DDL.includes(role.type)) continue;

    const hasEscapeHatch = role.justification && role.justification.includes('@ddl-ok');
    if (hasEscapeHatch) continue;

    if (!Array.isArray(role.privileges)) continue;

    const forbiddenFound = role.privileges.filter(p => {
      const priv = String(p).toUpperCase().trim();
      return DDL_PRIVILEGES.includes(priv);
    });

    if (forbiddenFound.length > 0) {
      violations.push(
        `Role "${role.name}" (type: "${role.type}") has DDL privilege(s): ${forbiddenFound.join(', ')}. ` +
        'Only migration/admin roles may have DDL privileges.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RPP003',
      message: `${violations.length} role(s) with unauthorized DDL privileges`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RPP003',
    message: 'No unauthorized DDL privileges on application/analytics roles',
  };
}
