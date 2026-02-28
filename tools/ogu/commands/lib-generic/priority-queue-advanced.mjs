/**
 * Priority Queue Advanced — priority queue with max-priority dequeue.
 */
export function createPriorityQueueAdvanced() {
  const items = [];
  function enqueue(value, priority) { items.push({ value, priority }); items.sort((a,b) => b.priority - a.priority); }
  function dequeue() { return items.length > 0 ? items.shift().value : null; }
  function peek() { return items.length > 0 ? items[0].value : null; }
  function size() { return items.length; }
  function isEmpty() { return items.length === 0; }
  return { enqueue, dequeue, peek, size, isEmpty };
}
