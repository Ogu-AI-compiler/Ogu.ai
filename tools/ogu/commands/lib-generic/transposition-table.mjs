/**
 * Transposition Table — hash-based game position cache.
 */
export function createTranspositionTable(size) {
  const table = new Map();
  let hits = 0, misses = 0;
  function store(hash, entry) { table.set(hash % size, { hash, ...entry }); }
  function lookup(hash) {
    const entry = table.get(hash % size);
    if (entry && entry.hash === hash) { hits++; return entry; }
    misses++;
    return null;
  }
  function clear() { table.clear(); }
  function getStats() { return { hits, misses, entries: table.size }; }
  return { store, lookup, clear, getStats };
}
