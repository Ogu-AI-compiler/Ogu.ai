/**
 * TLB Cache — Translation Lookaside Buffer with LRU eviction.
 */
export function createTLBCache({ capacity }) {
  const cache = new Map();
  let hits = 0, misses = 0;
  function insert(virtualPage, physicalFrame) {
    if (cache.has(virtualPage)) cache.delete(virtualPage);
    if (cache.size >= capacity) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(virtualPage, physicalFrame);
  }
  function lookup(virtualPage) {
    if (cache.has(virtualPage)) {
      hits++;
      const val = cache.get(virtualPage);
      cache.delete(virtualPage);
      cache.set(virtualPage, val);
      return val;
    }
    misses++;
    return null;
  }
  function flush() { cache.clear(); }
  function getStats() { return { hits, misses, size: cache.size, capacity }; }
  return { insert, lookup, flush, getStats };
}
