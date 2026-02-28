/**
 * Resource Guard — protect resources with access policies.
 */
export function createResourceGuard() {
  const guards = new Map();
  function protect(resource, policy) { guards.set(resource, policy); }
  function canAccess(resource, context) {
    const policy = guards.get(resource);
    if (!policy) return true;
    return policy(context);
  }
  function listResources() { return [...guards.keys()]; }
  return { protect, canAccess, listResources };
}
