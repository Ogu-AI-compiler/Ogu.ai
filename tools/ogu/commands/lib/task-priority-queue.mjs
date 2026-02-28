/**
 * Task Priority Queue — priority queue with deadline-aware scheduling.
 */

/**
 * Create a deadline-aware priority queue.
 *
 * @returns {object} Queue with add/next/peek/size
 */
export function createTaskPriorityQueue() {
  const items = [];
  let insertOrder = 0;

  function effectivePriority(item) {
    let p = item.priority || 0;
    // Boost priority for approaching deadlines
    if (item.deadline) {
      const remaining = item.deadline - Date.now();
      if (remaining < 60000) p += 20;       // < 1 min
      else if (remaining < 300000) p += 10;  // < 5 min
      else if (remaining < 3600000) p += 5;  // < 1 hour
    }
    return p;
  }

  function sortQueue() {
    items.sort((a, b) => {
      const pa = effectivePriority(a);
      const pb = effectivePriority(b);
      if (pb !== pa) return pb - pa;
      return a._order - b._order; // FIFO for same priority
    });
  }

  function add(item) {
    items.push({ ...item, _order: insertOrder++ });
    sortQueue();
  }

  function next() {
    if (items.length === 0) return null;
    sortQueue();
    return items.shift();
  }

  function peek() {
    if (items.length === 0) return null;
    sortQueue();
    return items[0];
  }

  function size() {
    return items.length;
  }

  return { add, next, peek, size };
}
