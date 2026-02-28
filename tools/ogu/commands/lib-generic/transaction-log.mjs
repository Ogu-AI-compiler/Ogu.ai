/**
 * Transaction Log — append-only log of all state transitions.
 */

/**
 * Create an append-only transaction log.
 *
 * @returns {object} Log with append/getEntries/getByType/getSince
 */
export function createTransactionLog() {
  const entries = [];
  let nextSeq = 1;

  function append(entry) {
    entries.push({
      ...entry,
      seq: nextSeq++,
      timestamp: new Date().toISOString(),
    });
  }

  function getEntries() {
    return [...entries];
  }

  function getByType(type) {
    return entries.filter(e => e.type === type);
  }

  function getSince(seq) {
    return entries.filter(e => e.seq > seq);
  }

  return { append, getEntries, getByType, getSince };
}
