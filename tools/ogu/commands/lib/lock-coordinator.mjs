/**
 * Lock Coordinator — coordinate file locks across agents.
 */

/**
 * Create a lock coordinator.
 *
 * @returns {object} Coordinator with acquire/release/isLocked/listLocks/getHolder
 */
export function createLockCoordinator() {
  const locks = new Map(); // resource → { holder, acquiredAt }

  function acquire(resource, agentId) {
    const existing = locks.get(resource);
    if (existing && existing.holder !== agentId) {
      return { acquired: false, heldBy: existing.holder };
    }
    locks.set(resource, { holder: agentId, acquiredAt: new Date().toISOString() });
    return { acquired: true, resource, holder: agentId };
  }

  function release(resource, agentId) {
    const existing = locks.get(resource);
    if (!existing) return false;
    if (existing.holder !== agentId) return false;
    locks.delete(resource);
    return true;
  }

  function isLocked(resource) {
    return locks.has(resource);
  }

  function getHolder(resource) {
    const l = locks.get(resource);
    return l ? l.holder : null;
  }

  function listLocks() {
    return Array.from(locks.entries()).map(([resource, info]) => ({
      resource,
      holder: info.holder,
      acquiredAt: info.acquiredAt,
    }));
  }

  return { acquire, release, isLocked, getHolder, listLocks };
}
