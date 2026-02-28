/**
 * Sorted Set — unique elements maintained in sorted order.
 */
export function createSortedSet(comparator = (a, b) => a - b) {
  const items = [];

  function findIndex(value) {
    let lo = 0, hi = items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (comparator(items[mid], value) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function add(value) {
    const idx = findIndex(value);
    if (idx < items.length && comparator(items[idx], value) === 0) return false;
    items.splice(idx, 0, value);
    return true;
  }

  function has(value) {
    const idx = findIndex(value);
    return idx < items.length && comparator(items[idx], value) === 0;
  }

  function remove(value) {
    const idx = findIndex(value);
    if (idx < items.length && comparator(items[idx], value) === 0) {
      items.splice(idx, 1);
      return true;
    }
    return false;
  }

  function toArray() { return [...items]; }
  function size() { return items.length; }

  return { add, has, remove, toArray, size };
}
