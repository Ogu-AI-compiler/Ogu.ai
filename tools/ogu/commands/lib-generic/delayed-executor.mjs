/**
 * Delayed Executor — schedule tasks with delays and cancellation.
 */

let nextId = 1;

export function createDelayedExecutor() {
  const tasks = new Map();

  function schedule({ task, delayMs, handler }) {
    const id = `delayed-${nextId++}`;
    tasks.set(id, {
      id,
      task,
      delayMs,
      handler: handler || (() => {}),
      scheduledAt: Date.now(),
      executeAt: Date.now() + delayMs,
    });
    return id;
  }

  function cancel(id) {
    if (!tasks.has(id)) return false;
    tasks.delete(id);
    return true;
  }

  function getPending() {
    return [...tasks.values()].map(t => ({
      id: t.id,
      task: t.task,
      delayMs: t.delayMs,
      executeAt: t.executeAt,
    }));
  }

  function executeReady() {
    const now = Date.now();
    const ready = [];
    for (const [id, t] of tasks) {
      if (t.executeAt <= now) {
        ready.push(t);
      }
    }
    for (const t of ready) {
      tasks.delete(t.id);
      t.handler();
    }
    return ready.length;
  }

  return { schedule, cancel, getPending, executeReady };
}
