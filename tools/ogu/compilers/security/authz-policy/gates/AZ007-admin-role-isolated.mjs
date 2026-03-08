import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AZ007 — admin-role-isolated: admin role must require elevated authentication (MFA) */
export async function run({ dir }) {
  const specPath = join(dir, 'authz-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'AZ007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'AZ007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'AZ007', message: 'No roles array — gate skipped', skipped: true };
  }

  const ADMIN_ROLE_NAMES = ['admin', 'super-admin', 'superadmin', 'administrator', 'root', 'owner'];
  const adminRoles = spec.roles.filter(role => {
    const name = String(role.name || role.id || role || '').toLowerCase();
    return ADMIN_ROLE_NAMES.some(adminName => name === adminName || name.includes(adminName));
  });

  if (adminRoles.length === 0) {
    return { pass: true, code: 'AZ007', message: 'No admin roles declared — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of adminRoles) {
    const roleName = typeof role === 'object' ? (role.name || role.id || 'admin') : String(role);
    const roleObj = typeof role === 'object' ? role : {};

    // Admin roles should require MFA or elevated auth
    const hasMfaRequired = roleObj.requires_mfa === true ||
      roleObj.mfa_required === true ||
      (typeof roleObj.auth_requirements === 'string' && roleObj.auth_requirements.toLowerCase().includes('mfa'));

    if (!hasMfaRequired) {
      violations.push(`Admin role "${roleName}": requires_mfa must be true — admin-tier access must enforce multi-factor authentication`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'AZ007',
      message: `${violations.length} admin role(s) do not require MFA`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'AZ007', message: `All ${adminRoles.length} admin role(s) require MFA` };
}
