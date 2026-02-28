/**
 * Segment Range Tree — store intervals and query point containment.
 */
export function createSegmentRangeTree() {
  const intervals = [];
  function insert(start, end, value) { intervals.push({ start, end, value }); }
  function query(point) {
    return intervals.filter(i => point >= i.start && point <= i.end).map(i => i.value);
  }
  function queryRange(start, end) {
    return intervals.filter(i => i.start <= end && i.end >= start).map(i => i.value);
  }
  return { insert, query, queryRange };
}
