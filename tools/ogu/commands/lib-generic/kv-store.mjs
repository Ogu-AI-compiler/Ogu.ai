/**
 * Key-Value Store — in-memory key-value storage.
 */
export function createKVStore() {
  const store = new Map();

  function set(key, value) { store.set(key, value); }
  function get(key) { return store.get(key); }
  function has(key) { return store.has(key); }
  function keys() { return [...store.keys()]; }
  function values() { return [...store.values()]; }
  function size() { return store.size; }

  function delete_(key) { return store.delete(key); }

  return { set, get, has, delete: delete_, keys, values, size };
}
