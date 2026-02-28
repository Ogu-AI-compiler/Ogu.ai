/**
 * Object Pool — reuse pre-allocated objects to reduce GC pressure.
 */
export function createObjectPool(factory, maxSize) {
  const pool = [];
  for (let i = 0; i < maxSize; i++) pool.push(factory());
  const inUse = new Set();

  function acquire() {
    if (pool.length === 0) return null;
    const obj = pool.pop();
    inUse.add(obj);
    return obj;
  }

  function release(obj) {
    if (!inUse.has(obj)) return;
    inUse.delete(obj);
    pool.push(obj);
  }

  function available() {
    return pool.length;
  }

  return { acquire, release, available };
}
