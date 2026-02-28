/**
 * Eviction Policy — pluggable eviction strategies (FIFO, LRU).
 */
export function createEvictionPolicy(strategy = "fifo") {
  const items = [];
  function track(key) { items.push(key); }
  function access(key) {
    if (strategy === "lru") {
      const idx = items.indexOf(key);
      if (idx >= 0) { items.splice(idx, 1); items.push(key); }
    }
  }
  function evict() {
    if (items.length === 0) return null;
    return items.shift();
  }
  return { track, access, evict };
}
