/**
 * Content Addressable Store — store data indexed by content hash.
 */
export function createContentAddressableStore(hashFn) {
  const store = new Map();
  function put(data) {
    const hash = hashFn(data);
    store.set(hash, data);
    return hash;
  }
  function get(hash) { return store.get(hash) || null; }
  function has(hash) { return store.has(hash); }
  function remove(hash) { store.delete(hash); }
  function list() { return [...store.keys()]; }
  function count() { return store.size; }
  return { put, get, has, remove, list, count };
}
