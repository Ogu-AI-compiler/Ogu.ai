/**
 * Page Cache — LRU page cache with hit/miss tracking.
 */
export function createPageCache({ maxPages }) {
  const pages = new Map();
  let hits = 0;
  let misses = 0;

  function put(pageId, data) {
    if (pages.has(pageId)) {
      pages.delete(pageId);
    } else if (pages.size >= maxPages) {
      const oldest = pages.keys().next().value;
      pages.delete(oldest);
    }
    pages.set(pageId, data);
  }

  function get(pageId) {
    if (pages.has(pageId)) {
      hits++;
      const data = pages.get(pageId);
      pages.delete(pageId);
      pages.set(pageId, data);
      return data;
    }
    misses++;
    return null;
  }

  function getStats() {
    return { hits, misses, size: pages.size, maxPages };
  }

  return { put, get, getStats };
}
