/**
 * R-Tree — simple rectangle-based spatial index.
 */
export function createRTree() {
  const items = [];

  function overlaps(a, b) {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
  }

  function insert(rect) {
    items.push(rect);
  }

  function search(query) {
    return items.filter(item => overlaps(item, query));
  }

  function getAll() { return [...items]; }

  return { insert, search, getAll };
}
