/**
 * Connection Pool — reusable connection pool with acquire/release semantics.
 */

let nextId = 1;

/**
 * @param {{ maxSize: number }} opts
 */
export function createConnectionPool({ maxSize = 10 } = {}) {
  const active = new Map();   // id → connection
  const idle = [];             // array of connections

  function acquire() {
    if (idle.length > 0) {
      const conn = idle.pop();
      active.set(conn.id, conn);
      return conn;
    }
    if (active.size >= maxSize) return null;
    const conn = { id: `conn-${nextId++}`, createdAt: Date.now() };
    active.set(conn.id, conn);
    return conn;
  }

  function release(id) {
    const conn = active.get(id);
    if (!conn) return;
    active.delete(id);
    idle.push(conn);
  }

  function getStats() {
    return {
      active: active.size,
      idle: idle.length,
      total: active.size + idle.length,
      maxSize,
    };
  }

  return { acquire, release, getStats };
}
