/**
 * Speculative Executor — speculatively execute tasks and commit or rollback.
 */
export function createSpeculativeExecutor() {
  const pending = new Map();
  const committed = new Map();
  function speculate(id, fn) { pending.set(id, fn()); }
  function commit(id) { if (pending.has(id)) { committed.set(id, pending.get(id)); pending.delete(id); } }
  function rollback(id) { pending.delete(id); committed.delete(id); }
  function getResult(id) { return committed.get(id) ?? null; }
  return { speculate, commit, rollback, getResult };
}
