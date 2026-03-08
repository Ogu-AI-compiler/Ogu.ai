/**
 * FIFO Queue — first-in first-out queue.
 */
export function createFIFOQueue() {
  const items = [];
  function enqueue(item) { items.push(item); }
  function dequeue() { return items.shift(); }
  function peek() { return items[0]; }
  function size() { return items.length; }
  function isEmpty() { return items.length === 0; }
  return { enqueue, dequeue, peek, size, isEmpty };
}
