/**
 * Promise Pool — run async tasks with concurrency limit.
 */
export function createPromisePool(concurrency) {
  const queue = [];
  let running = 0, completed = 0, failed = 0;
  function add(taskFn) { queue.push(taskFn); }
  async function drain() {
    const results = [];
    async function runNext() {
      if (queue.length === 0) return;
      const task = queue.shift();
      running++;
      try { await task(); completed++; }
      catch { failed++; }
      finally { running--; }
      await runNext();
    }
    const workers = [];
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);
    return results;
  }
  function getStats() { return { completed, failed, running, pending: queue.length }; }
  return { add, drain, getStats };
}
