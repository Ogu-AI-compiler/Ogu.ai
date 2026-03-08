/**
 * Range Query Engine — query items by numeric value range.
 */
export function createRangeQueryEngine() {
  const items = [];
  function add(key, value) { items.push({ key, value }); }
  function query(min, max) {
    return items.filter(i => i.value >= min && i.value <= max).sort((a, b) => a.value - b.value);
  }
  return { add, query };
}
