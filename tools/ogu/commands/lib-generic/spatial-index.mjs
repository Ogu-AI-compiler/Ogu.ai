/**
 * Spatial Index — simple point-based spatial lookup.
 */
export function createSpatialIndex() {
  const points = [];

  function insert(id, x, y) {
    points.push({ id, x, y });
  }

  function queryRadius(cx, cy, radius) {
    return points.filter(p => {
      const dx = p.x - cx, dy = p.y - cy;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  function getAll() { return [...points]; }

  return { insert, queryRadius, getAll };
}
