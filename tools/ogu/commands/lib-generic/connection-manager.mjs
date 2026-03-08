/**
 * Connection Manager — manage connection lifecycle with monitoring.
 */

let nextId = 1;

export function createConnectionManager() {
  const connections = new Map();

  function open(config) {
    const id = `conn-${nextId++}`;
    const conn = {
      id,
      config,
      status: "open",
      openedAt: Date.now(),
      closedAt: null,
    };
    connections.set(id, conn);
    return { id: conn.id, status: conn.status };
  }

  function close(id) {
    const conn = connections.get(id);
    if (!conn) throw new Error(`Unknown connection: ${id}`);
    conn.status = "closed";
    conn.closedAt = Date.now();
  }

  function getConnection(id) {
    const conn = connections.get(id);
    if (!conn) throw new Error(`Unknown connection: ${id}`);
    return { ...conn };
  }

  function listConnections() {
    return [...connections.values()].map(c => ({ ...c }));
  }

  function getStats() {
    let open = 0, closed = 0;
    for (const c of connections.values()) {
      if (c.status === "open") open++;
      else if (c.status === "closed") closed++;
    }
    return { open, closed, total: connections.size };
  }

  return { open, close, getConnection, listConnections, getStats };
}
