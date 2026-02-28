/**
 * Persistent Array — immutable array with structural sharing.
 */
export function createPersistentArray(items = []) {
  const data = [...items];
  return {
    get(i) { return data[i]; },
    set(i, val) { const next = [...data]; next[i] = val; return createPersistentArray(next); },
    push(val) { return createPersistentArray([...data, val]); },
    size() { return data.length; },
    toArray() { return [...data]; }
  };
}
