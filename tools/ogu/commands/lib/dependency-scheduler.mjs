/**
 * Dependency Scheduler — schedule tasks based on dependency resolution.
 */
export function createDependencyScheduler() {
  const tasks = new Map();
  const completed = new Set();
  function addTask(id, deps) { tasks.set(id, deps); }
  function getReady() {
    const ready = [];
    for (const [id, deps] of tasks) {
      if (completed.has(id)) continue;
      if (deps.every(d => completed.has(d))) ready.push(id);
    }
    return ready;
  }
  function complete(id) { completed.add(id); }
  function isComplete() {
    for (const id of tasks.keys()) { if (!completed.has(id)) return false; }
    return true;
  }
  return { addTask, getReady, complete, isComplete };
}
