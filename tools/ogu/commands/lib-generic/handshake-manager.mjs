/**
 * Handshake Manager — negotiate and validate connection parameters.
 */

let nextId = 1;

export function createHandshakeManager() {
  const handshakes = new Map();

  function initiate(params) {
    const id = `hs-${nextId++}`;
    const hs = {
      id,
      params,
      status: "pending",
      initiatedAt: Date.now(),
      response: null,
      reason: null,
    };
    handshakes.set(id, hs);
    return { id: hs.id, status: hs.status };
  }

  function accept(id, response) {
    const hs = handshakes.get(id);
    if (!hs) throw new Error(`Unknown handshake: ${id}`);
    hs.status = "completed";
    hs.response = response;
    hs.completedAt = Date.now();
  }

  function reject(id, reason) {
    const hs = handshakes.get(id);
    if (!hs) throw new Error(`Unknown handshake: ${id}`);
    hs.status = "rejected";
    hs.reason = reason;
    hs.completedAt = Date.now();
  }

  function getStatus(id) {
    const hs = handshakes.get(id);
    if (!hs) throw new Error(`Unknown handshake: ${id}`);
    return { status: hs.status, reason: hs.reason, response: hs.response };
  }

  function getStats() {
    let pending = 0, completed = 0, rejected = 0;
    for (const hs of handshakes.values()) {
      if (hs.status === "pending") pending++;
      else if (hs.status === "completed") completed++;
      else if (hs.status === "rejected") rejected++;
    }
    return { pending, completed, rejected, total: handshakes.size };
  }

  return { initiate, accept, reject, getStatus, getStats };
}
