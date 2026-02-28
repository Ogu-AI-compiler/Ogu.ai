/**
 * TopK Tracker — maintain the K largest elements.
 */
export function createTopKTracker(k) {
  const items = [];

  function add(value) {
    items.push(value);
    items.sort((a, b) => b - a);
    if (items.length > k) items.pop();
  }

  function getTop() { return [...items]; }
  function getMin() { return items.length > 0 ? items[items.length - 1] : null; }

  return { add, getTop, getMin };
}
