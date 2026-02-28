/**
 * Cuckoo Filter — probabilistic set membership with deletion support.
 */
export function createCuckooFilter(capacity) {
  const buckets = new Array(capacity).fill(null);
  function fingerprint(item) {
    let h = 0;
    const s = String(item);
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return (h & 0xFF) || 1;
  }
  function hash1(item) {
    let h = 0;
    const s = String(item);
    for (let i = 0; i < s.length; i++) h = ((h << 7) - h + s.charCodeAt(i)) | 0;
    return (h >>> 0) % capacity;
  }
  function insert(item) {
    const fp = fingerprint(item);
    const idx = hash1(item);
    if (buckets[idx] === null) { buckets[idx] = fp; return true; }
    const alt = (idx ^ (fp * 0x5bd1e995)) % capacity;
    const altIdx = alt < 0 ? alt + capacity : alt;
    if (buckets[altIdx] === null) { buckets[altIdx] = fp; return true; }
    buckets[idx] = fp;
    return true;
  }
  function lookup(item) {
    const fp = fingerprint(item);
    const idx = hash1(item);
    if (buckets[idx] === fp) return true;
    const alt = (idx ^ (fp * 0x5bd1e995)) % capacity;
    const altIdx = alt < 0 ? alt + capacity : alt;
    return buckets[altIdx] === fp;
  }
  function del(item) {
    const fp = fingerprint(item);
    const idx = hash1(item);
    if (buckets[idx] === fp) { buckets[idx] = null; return true; }
    const alt = (idx ^ (fp * 0x5bd1e995)) % capacity;
    const altIdx = alt < 0 ? alt + capacity : alt;
    if (buckets[altIdx] === fp) { buckets[altIdx] = null; return true; }
    return false;
  }
  return { insert, lookup, delete: del };
}
