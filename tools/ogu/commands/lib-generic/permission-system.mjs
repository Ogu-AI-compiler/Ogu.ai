/**
 * Permission System — user-level permission grants.
 */
export function createPermissionSystem() {
  const permissions = new Map();
  function grant(user, perm) {
    if (!permissions.has(user)) permissions.set(user, new Set());
    permissions.get(user).add(perm);
  }
  function revoke(user, perm) {
    const set = permissions.get(user);
    if (set) set.delete(perm);
  }
  function check(user, perm) {
    const set = permissions.get(user);
    return set ? set.has(perm) : false;
  }
  function list(user) { return [...(permissions.get(user) || [])]; }
  return { grant, revoke, check, list };
}
