/**
 * Task Queue — priority task queue with concurrency control.
 */
export function createTaskQueue(concurrency = 1) {
  const pending = [];
  let running = 0;
  const completed = [];
  function add(name, fn, priority = 0) {
    pending.push({ name, fn, priority });
    pending.sort((a, b) => b.priority - a.priority);
  }
  function processNext() {
    if (running >= concurrency || pending.length === 0) return null;
    const task = pending.shift();
    running++;
    try {
      const result = task.fn();
      completed.push({ name: task.name, result, status: 'done' });
      return result;
    } catch (e) {
      completed.push({ name: task.name, error: e.message, status: 'error' });
      throw e;
    } finally {
      running--;
    }
  }
  function drain() {
    const results = [];
    while (pending.length > 0) results.push(processNext());
    return results;
  }
  function getStats() { return { pending: pending.length, running, completed: completed.length }; }
  return { add, processNext, drain, getStats };
}
