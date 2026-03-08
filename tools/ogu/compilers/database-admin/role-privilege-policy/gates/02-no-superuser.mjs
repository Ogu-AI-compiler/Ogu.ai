/**
 * Gate: no-superuser (RPP002)
 * No application, analytics, or readonly role may have superuser: true.
 * A superuser role bypasses all PostgreSQL access controls — any credential
 * compromise becomes a full database takeover.
 *
 * Only roles of type "admin" may have superuser, and only with explicit
 * justification in the justification field.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROLES_THAT_MAY_HAVE_SUPERUSER = ['admin'];

export async function run({ dir }) {
  const specPath = join(dir, 'role-privilege-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RPP002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RPP002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'RPP002', message: 'No roles array — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of spec.roles) {
    if (role.superuser !== true) continue;

    if (!ROLES_THAT_MAY_HAVE_SUPERUSER.includes(role.type)) {
      violations.push(
        `Role "${role.name}" (type: "${role.type}") has superuser: true. ` +
        'Only admin roles may be superusers. Application, analytics, and readonly roles must not have superuser.'
      );
    } else if (!role.justification) {
      violations.push(
        `Role "${role.name}" (admin superuser) is missing a justification field. ` +
        'Superuser access requires a documented reason.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RPP002',
      message: `${violations.length} unauthorized superuser role(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RPP002',
    message: 'No unauthorized superuser roles',
  };
}
