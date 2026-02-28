/**
 * Round Robin Scheduler — cycle through items in order.
 */
export function createRoundRobinScheduler() {
  const items = [];
  let index = 0;
  function add(item) { items.push(item); }
  function remove(item) {
    const idx = items.indexOf(item);
    if (idx >= 0) { items.splice(idx, 1); if (index >= items.length) index = 0; }
  }
  function next() {
    if (items.length === 0) return null;
    const item = items[index % items.length];
    index = (index + 1) % items.length;
    return item;
  }
  function reset() { index = 0; }
  function list() { return [...items]; }
  function size() { return items.length; }
  return { add, remove, next, reset, list, size };
}
