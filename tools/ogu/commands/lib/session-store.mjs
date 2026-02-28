/**
 * Session Store — in-memory session management with expiry.
 */
export function createSessionStore(ttlMs = 3600000) {
  const sessions = new Map();
  let nextId = 1;
  function create(data = {}) {
    const id = `sess_${nextId++}`;
    sessions.set(id, { id, data: { ...data }, createdAt: Date.now(), expiresAt: Date.now() + ttlMs });
    return id;
  }
  function get(id) {
    const s = sessions.get(id);
    if (!s) return null;
    if (Date.now() > s.expiresAt) { sessions.delete(id); return null; }
    return s.data;
  }
  function set(id, data) {
    const s = sessions.get(id);
    if (s) s.data = { ...s.data, ...data };
  }
  function destroy(id) { sessions.delete(id); }
  function count() { return sessions.size; }
  function prune() {
    const now = Date.now();
    for (const [id, s] of sessions) { if (now > s.expiresAt) sessions.delete(id); }
  }
  return { create, get, set, destroy, count, prune };
}
