/**
 * Search Index — index documents for keyword search.
 */
export function createSearchIndex() {
  const index = new Map();
  const docs = new Map();
  function add(id, text) {
    docs.set(id, text);
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (!index.has(word)) index.set(word, new Set());
      index.get(word).add(id);
    }
  }
  function search(query) {
    const words = query.toLowerCase().split(/\s+/);
    const results = new Map();
    for (const word of words) {
      const ids = index.get(word) || new Set();
      for (const id of ids) {
        results.set(id, (results.get(id) || 0) + 1);
      }
    }
    return [...results.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }
  function remove(id) {
    docs.delete(id);
    for (const [, ids] of index) ids.delete(id);
  }
  function count() { return docs.size; }
  return { add, search, remove, count };
}
