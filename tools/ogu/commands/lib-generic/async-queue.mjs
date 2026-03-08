/**
 * Async Queue — sequential async task processing.
 */
export function createAsyncQueue(processor) {
  const queue = [];
  let processed = 0, errors = 0;
  function enqueue(item) { queue.push(item); }
  async function drain() {
    while (queue.length > 0) {
      const item = queue.shift();
      try { await processor(item); processed++; }
      catch { errors++; }
    }
  }
  function getStats() { return { processed, errors, pending: queue.length }; }
  return { enqueue, drain, getStats };
}
