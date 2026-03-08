/**
 * String Pool — pooled string storage with reference counting.
 */
export function createStringPool() {
  const pool = new Map();
  let totalAcquires = 0;

  function acquire(str) {
    totalAcquires++;
    if (!pool.has(str)) pool.set(str, { refCount: 0 });
    pool.get(str).refCount++;
    return str;
  }

  function release(str) {
    if (!pool.has(str)) return;
    const entry = pool.get(str);
    entry.refCount--;
    if (entry.refCount <= 0) pool.delete(str);
  }

  function getStats() {
    return { unique: pool.size, total: totalAcquires };
  }

  return { acquire, release, getStats };
}
