/**
 * Cache Layer — in-memory cache with LRU-like eviction.
 */
export function createCache({ maxSize }) {
  const store = new Map();
  let hits = 0, misses = 0;

  function set(key, value) {
    if (store.size >= maxSize && !store.has(key)) {
      const oldest = store.keys().next().value;
      store.delete(oldest);
    }
    store.set(key, value);
  }

  function get(key) {
    if (store.has(key)) { hits++; return store.get(key); }
    misses++;
    return undefined;
  }

  function del(key) { store.delete(key); }

  function getStats() { return { hits, misses, size: store.size, maxSize }; }

  return { set, get, delete: del, getStats };
}
