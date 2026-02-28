/**
 * Permission Matrix — role×action matrix with inheritance.
 */

/**
 * Create a permission matrix.
 * @returns {object} Matrix with grant/revoke/check/inherit/getPermissions
 */
export function createMatrix() {
  const matrix = new Map(); // role -> Set<action>

  function ensure(role) {
    if (!matrix.has(role)) matrix.set(role, new Set());
    return matrix.get(role);
  }

  function grant(role, action) {
    ensure(role).add(action);
  }

  function revoke(role, action) {
    ensure(role).delete(action);
  }

  function check(role, action) {
    const perms = matrix.get(role);
    return perms ? perms.has(action) : false;
  }

  function inherit(childRole, parentRole) {
    const parent = matrix.get(parentRole);
    if (!parent) return;
    const child = ensure(childRole);
    for (const action of parent) {
      child.add(action);
    }
  }

  function getPermissions(role) {
    const perms = matrix.get(role);
    return perms ? [...perms] : [];
  }

  return { grant, revoke, check, inherit, getPermissions };
}

/**
 * Create a permission matrix with wildcard support.
 * @returns {object} Matrix with grant/revoke/check/listPermissions
 */
export function createPermissionMatrix() {
  const permissions = new Map();

  function grant(role, permission) {
    if (!permissions.has(role)) permissions.set(role, new Set());
    permissions.get(role).add(permission);
  }

  function revoke(role, permission) {
    const perms = permissions.get(role);
    if (perms) perms.delete(permission);
  }

  function check(role, permission) {
    const perms = permissions.get(role);
    if (!perms) return false;
    if (perms.has('*')) return true;
    return perms.has(permission);
  }

  function listPermissions(role) {
    const perms = permissions.get(role);
    return perms ? Array.from(perms) : [];
  }

  return { grant, revoke, check, listPermissions };
}
