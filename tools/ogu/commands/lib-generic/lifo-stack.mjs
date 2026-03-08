/**
 * LIFO Stack — last-in first-out stack.
 */
export function createLIFOStack() {
  const items = [];
  function push(item) { items.push(item); }
  function pop() { return items.pop(); }
  function peek() { return items[items.length - 1]; }
  function size() { return items.length; }
  function isEmpty() { return items.length === 0; }
  return { push, pop, peek, size, isEmpty };
}
