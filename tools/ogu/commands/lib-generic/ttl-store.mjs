/**
 * TTL Store — key-value store with time-to-live expiration.
 */

/**
 * Create a TTL store.
 * @returns {object} Store with set/get/has/cleanup/size
 */
export function createTTLStore() {
  const store = new Map(); // key -> { value, expiresAt }

  function set(key, value, { ttlMs }) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function has(key) {
    return get(key) !== undefined;
  }

  function cleanup() {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiresAt) {
        store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  function size() {
    const now = Date.now();
    let count = 0;
    for (const entry of store.values()) {
      if (now <= entry.expiresAt) count++;
    }
    return count;
  }

  return { set, get, has, cleanup, size };
}
