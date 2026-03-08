/**
 * Gate: migration-role-separation (RPP006)
 * Migration roles must have CREATE and ALTER privileges.
 * Application roles must NOT have CREATE or ALTER privileges.
 * This separation ensures that only the migration runner can modify schema —
 * application code cannot accidentally run DDL during normal operation.
 *
 * If no migration role is declared, the gate fails — schema migrations need
 * a dedicated role with DDL access.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'role-privilege-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RPP006', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RPP006', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'RPP006', message: 'No roles array — gate skipped', skipped: true };
  }

  const migrationRoles = spec.roles.filter(r => r.type === 'migration');
  const applicationRoles = spec.roles.filter(r => r.type === 'application');

  const violations = [];

  // There must be at least one migration role
  if (migrationRoles.length === 0) {
    violations.push(
      'No migration role declared. Schema migrations require a dedicated role with DDL access (type: "migration").'
    );
  }

  // Migration roles must have CREATE and ALTER
  for (const role of migrationRoles) {
    if (!Array.isArray(role.privileges)) continue;
    const privs = role.privileges.map(p => String(p).toUpperCase().trim());
    if (!privs.includes('CREATE')) {
      violations.push(`Migration role "${role.name}" is missing CREATE privilege.`);
    }
    if (!privs.includes('ALTER')) {
      violations.push(`Migration role "${role.name}" is missing ALTER privilege.`);
    }
  }

  // Application roles must NOT have CREATE or ALTER
  for (const role of applicationRoles) {
    if (!Array.isArray(role.privileges)) continue;
    const privs = role.privileges.map(p => String(p).toUpperCase().trim());
    if (privs.includes('CREATE')) {
      violations.push(`Application role "${role.name}" has CREATE privilege — only migration roles may have CREATE.`);
    }
    if (privs.includes('ALTER')) {
      violations.push(`Application role "${role.name}" has ALTER privilege — only migration roles may have ALTER.`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RPP006',
      message: `${violations.length} migration/application role separation violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RPP006',
    message: `Migration role separation enforced — ${migrationRoles.length} migration role(s), ${applicationRoles.length} application role(s)`,
  };
}
