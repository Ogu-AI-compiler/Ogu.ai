/**
 * Priority Scheduler — weighted priority task scheduling.
 */

export const PRIORITY_LEVELS = {
  critical: 100,
  high: 75,
  normal: 50,
  low: 25,
  background: 10,
};

/**
 * Create a priority scheduler (max-priority dequeue).
 * @returns {object} Scheduler with enqueue/dequeue/peek/size
 */
export function createPriorityScheduler() {
  const queue = [];

  function enqueue(item) {
    queue.push(item);
    // Sort descending by priority
    queue.sort((a, b) => b.priority - a.priority);
  }

  function dequeue() {
    return queue.shift() || null;
  }

  function peek() {
    return queue[0] || null;
  }

  function size() {
    return queue.length;
  }

  return { enqueue, dequeue, peek, size };
}
