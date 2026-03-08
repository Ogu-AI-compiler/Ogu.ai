/**
 * Resource Reclaimer — reclaim leaked resources with TTL tracking.
 */

export function createResourceReclaimer() {
  const tracked = new Map();
  let totalReclaimed = 0;

  function track(id, { type, ttlMs }) {
    tracked.set(id, {
      id,
      type,
      ttlMs,
      trackedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  function release(id) {
    tracked.delete(id);
  }

  function reclaimExpired() {
    const now = Date.now();
    let count = 0;
    for (const [id, r] of tracked) {
      if (r.expiresAt <= now) {
        tracked.delete(id);
        count++;
      }
    }
    totalReclaimed += count;
    return count;
  }

  function getTracked() {
    return [...tracked.values()];
  }

  function getStats() {
    return {
      tracked: tracked.size,
      totalReclaimed,
    };
  }

  return { track, release, reclaimExpired, getTracked, getStats };
}
