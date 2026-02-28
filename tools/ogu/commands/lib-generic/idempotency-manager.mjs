/**
 * Idempotency Manager — prevent duplicate execution with idempotency keys.
 */

/**
 * Create an idempotency manager.
 *
 * @returns {object} Manager with check/record/getResult/clear
 */
export function createIdempotencyManager() {
  const store = new Map(); // key → { result, recordedAt }

  function check(key) {
    return store.has(key);
  }

  function record(key, result) {
    store.set(key, { result, recordedAt: new Date().toISOString() });
  }

  function getResult(key) {
    const entry = store.get(key);
    return entry ? entry.result : null;
  }

  function clear() {
    store.clear();
  }

  return { check, record, getResult, clear };
}
