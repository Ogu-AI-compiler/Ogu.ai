/**
 * Persistent Map — immutable map with structural sharing.
 */
export function createPersistentMap(entries = new Map()) {
  const data = new Map(entries);
  return {
    get(key) { return data.get(key); },
    set(key, val) { const next = new Map(data); next.set(key, val); return createPersistentMap(next); },
    delete(key) { const next = new Map(data); next.delete(key); return createPersistentMap(next); },
    has(key) { return data.has(key); },
    size() { return data.size; },
    keys() { return [...data.keys()]; }
  };
}
