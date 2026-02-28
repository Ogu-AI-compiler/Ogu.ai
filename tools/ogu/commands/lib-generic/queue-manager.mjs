/**
 * Queue Manager — FIFO and priority queue.
 */
export function createQueueManager({ mode = "fifo" } = {}) {
  const queue = [];

  function enqueue(item) {
    queue.push(item);
    if (mode === "priority") {
      queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
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
