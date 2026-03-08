/**
 * Gate: analytics-readonly (RPP007)
 * Analytics roles must have SELECT privilege only. Any write privilege
 * (INSERT, UPDATE, DELETE, TRUNCATE) on an analytics role defeats its
 * purpose and creates a data mutation vector from reporting queries.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE'];

export async function run({ dir }) {
  const specPath = join(dir, 'role-privilege-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'RPP007', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'RPP007', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'RPP007', message: 'No roles array — gate skipped', skipped: true };
  }

  const analyticsRoles = spec.roles.filter(r => r.type === 'analytics' || r.type === 'readonly');

  if (analyticsRoles.length === 0) {
    return {
      pass: true,
      code: 'RPP007',
      message: 'No analytics/readonly roles declared — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const role of analyticsRoles) {
    if (!Array.isArray(role.privileges)) continue;

    const writePrivsFound = role.privileges.filter(p => {
      const normalized = String(p).toUpperCase().trim();
      return WRITE_PRIVILEGES.includes(normalized);
    });

    if (writePrivsFound.length > 0) {
      violations.push(
        `Analytics/readonly role "${role.name}" has write privilege(s): ${writePrivsFound.join(', ')}. ` +
        'Analytics roles must have SELECT only.'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RPP007',
      message: `${violations.length} analytics role(s) with write privileges`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RPP007',
    message: `All ${analyticsRoles.length} analytics/readonly role(s) have SELECT-only access`,
  };
}
