/**
 * RBAC Engine — role-based access control.
 */
export function createRBACEngine() {
  const roles = new Map();
  const userRoles = new Map();
  function addRole(role, permissions) { roles.set(role, new Set(permissions)); }
  function assignRole(user, role) {
    if (!userRoles.has(user)) userRoles.set(user, new Set());
    userRoles.get(user).add(role);
  }
  function can(user, permission) {
    const uRoles = userRoles.get(user);
    if (!uRoles) return false;
    for (const role of uRoles) {
      const perms = roles.get(role);
      if (perms && perms.has(permission)) return true;
    }
    return false;
  }
  function getUserRoles(user) { return [...(userRoles.get(user) || [])]; }
  return { addRole, assignRole, can, getUserRoles };
}
