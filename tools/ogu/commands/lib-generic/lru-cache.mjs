/**
 * LRU Cache — least recently used eviction cache.
 */
export function createLRUCache(capacity) {
  const map = new Map();
  function get(key) {
    if (!map.has(key)) return undefined;
    const val = map.get(key);
    map.delete(key); map.set(key, val); // move to end
    return val;
  }
  function set(key, value) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    if (map.size > capacity) { map.delete(map.keys().next().value); }
  }
  function size() { return map.size; }
  return { get, set, size };
}
