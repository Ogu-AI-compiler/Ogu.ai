/**
 * Blob Storage — store and retrieve binary blobs by key.
 */
export function createBlobStorage() {
  const blobs = new Map();
  function put(key, data, metadata = {}) {
    blobs.set(key, { data, metadata: { ...metadata }, size: String(data).length, createdAt: Date.now() });
  }
  function get(key) {
    const blob = blobs.get(key);
    return blob ? blob.data : null;
  }
  function getMetadata(key) {
    const blob = blobs.get(key);
    return blob ? { ...blob.metadata, size: blob.size } : null;
  }
  function remove(key) { blobs.delete(key); }
  function list() { return [...blobs.keys()]; }
  function totalSize() { let s = 0; for (const b of blobs.values()) s += b.size; return s; }
  return { put, get, getMetadata, remove, list, totalSize };
}
