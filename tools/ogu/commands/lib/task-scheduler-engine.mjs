/**
 * Task Scheduler Engine — manage task queues with priorities.
 */

export function createTaskSchedulerEngine() {
  const queue = [];

  function add(task) {
    queue.push({ ...task, addedAt: Date.now() });
    queue.sort((a, b) => b.priority - a.priority); // highest first
  }

  function next() {
    if (queue.length === 0) return null;
    return queue.shift();
  }

  function getQueue() {
    return [...queue];
  }

  function getStats() {
    return {
      queued: queue.length,
    };
  }

  return { add, next, getQueue, getStats };
}
