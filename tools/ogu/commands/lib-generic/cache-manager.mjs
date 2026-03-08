/**
 * Cache Manager — LRU cache with configurable max size.
 */

/**
 * Create an LRU cache.
 *
 * @param {{ maxSize: number }} opts
 * @returns {object} Cache with get/set/has/delete/size
 */
export function createLRUCache({ maxSize }) {
  const cache = new Map();

  function get(key) {
    if (!cache.has(key)) return undefined;
    const value = cache.get(key);
    // Move to end (most recently used)
    cache.delete(key);
    cache.set(key, value);
    return value;
  }

  function set(key, value) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    if (cache.size > maxSize) {
      // Delete oldest (first key)
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  }

  function has(key) {
    return cache.has(key);
  }

  function del(key) {
    return cache.delete(key);
  }

  function size() {
    return cache.size;
  }

  return { get, set, has, delete: del, size };
}
