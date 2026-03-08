/**
 * Interval Tree — store intervals, query by point or range.
 */
export function createIntervalTree() {
  const intervals = [];
  function insert(low, high, data) { intervals.push({ low, high, data }); }
  function query(point) { return intervals.filter(i => point >= i.low && point <= i.high).map(i => i.data); }
  function queryRange(low, high) { return intervals.filter(i => i.low <= high && i.high >= low).map(i => i.data); }
  return { insert, query, queryRange };
}
