import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AZ006 — m2m-actors-scoped: machine-to-machine actors must be first-class subjects, not inheriting user roles */
export async function run({ dir }) {
  const specPath = join(dir, 'authz-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'AZ006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'AZ006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.roles)) {
    return { pass: true, code: 'AZ006', message: 'No roles array — gate skipped', skipped: true };
  }

  // Find M2M roles
  const M2M_INDICATORS = ['service', 'machine', 'bot', 'daemon', 'worker', 'cron', 'internal', 'system'];
  const m2mRoles = spec.roles.filter(role => {
    const roleName = String(role.name || role.id || role || '').toLowerCase();
    return M2M_INDICATORS.some(indicator => roleName.includes(indicator));
  });

  if (m2mRoles.length === 0) {
    return { pass: true, code: 'AZ006', message: 'No M2M roles declared — gate skipped', skipped: true };
  }

  const violations = [];

  for (const role of m2mRoles) {
    const roleName = role.name || role.id || String(role);
    const roleObj = typeof role === 'object' ? role : {};

    // M2M roles must not inherit from user roles
    const inheritsFrom = roleObj.inherits_from || roleObj.extends || roleObj.parent_role;
    if (inheritsFrom) {
      const inheritStr = String(inheritsFrom).toLowerCase();
      const userRoleTerms = ['user', 'member', 'customer', 'end-user'];
      if (userRoleTerms.some(term => inheritStr.includes(term))) {
        violations.push(`M2M role "${roleName}": inherits from user role "${inheritsFrom}" — M2M actors must have independent, scoped permissions, not inherit from human user roles`);
      }
    }

    // M2M roles should not have UI/user-facing permissions
    if (Array.isArray(roleObj.permissions)) {
      const uiPermissions = roleObj.permissions.filter(p => {
        const pStr = String(p).toLowerCase();
        return pStr.includes('ui') || pStr.includes('dashboard') || pStr.includes('frontend');
      });
      if (uiPermissions.length > 0) {
        violations.push(`M2M role "${roleName}": has UI/frontend permissions (${uiPermissions.join(', ')}) — M2M actors should only have API/backend scoped permissions`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'AZ006',
      message: `${violations.length} M2M role(s) are incorrectly scoped`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'AZ006', message: `All ${m2mRoles.length} M2M role(s) are properly scoped` };
}
