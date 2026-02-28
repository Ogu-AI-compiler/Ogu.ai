/**
 * Audit Logger — immutable audit trail for actions.
 */
export function createAuditLogger() {
  const entries = [];
  function log(action, user, details = {}) {
    entries.push({ action, user, details, timestamp: Date.now(), seq: entries.length });
  }
  function query(filter = {}) {
    return entries.filter(e => {
      if (filter.action && e.action !== filter.action) return false;
      if (filter.user && e.user !== filter.user) return false;
      return true;
    });
  }
  function count() { return entries.length; }
  function last(n = 10) { return entries.slice(-n); }
  function getAll() { return [...entries]; }
  return { log, query, count, last, getAll };
}
