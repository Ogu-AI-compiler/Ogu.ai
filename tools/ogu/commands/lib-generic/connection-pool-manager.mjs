/**
 * Connection Pool Manager — manage a pool of reusable connections.
 */
export function createConnectionPoolManager(maxSize, factory) {
  const available = [];
  const inUse = new Set();
  let created = 0;
  function acquire() {
    if (available.length > 0) {
      const conn = available.pop();
      inUse.add(conn);
      return conn;
    }
    if (created < maxSize) {
      const conn = factory(created);
      created++;
      inUse.add(conn);
      return conn;
    }
    return null;
  }
  function release(conn) {
    if (inUse.has(conn)) {
      inUse.delete(conn);
      available.push(conn);
    }
  }
  function getStats() {
    return { total: created, available: available.length, inUse: inUse.size, maxSize };
  }
  function drain() { available.length = 0; inUse.clear(); created = 0; }
  return { acquire, release, getStats, drain };
}
