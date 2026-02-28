/**
 * Priority Queue — highest priority dequeued first.
 */
export function createPriorityQueue() {
  const items = [];
  function enqueue(value, priority) {
    items.push({ value, priority });
    items.sort((a, b) => b.priority - a.priority);
  }
  function dequeue() {
    if (items.length === 0) return null;
    return items.shift().value;
  }
  function peek() {
    return items.length > 0 ? items[0].value : null;
  }
  function size() { return items.length; }
  return { enqueue, dequeue, peek, size };
}
