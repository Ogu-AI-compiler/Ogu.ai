/**
 * Quad Tree — spatial partitioning for 2D points.
 */
export function createQuadTree(bounds, capacity = 4) {
  const points = [];
  let divided = false;
  let nw, ne, sw, se;

  function contains(b, p) {
    return p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
  }

  function intersects(a, b) {
    return !(a.x > b.x + b.w || a.x + a.w < b.x || a.y > b.y + b.h || a.y + a.h < b.y);
  }

  function subdivide() {
    const { x, y, w, h } = bounds;
    const hw = w / 2, hh = h / 2;
    nw = createQuadTree({ x, y, w: hw, h: hh }, capacity);
    ne = createQuadTree({ x: x + hw, y, w: hw, h: hh }, capacity);
    sw = createQuadTree({ x, y: y + hh, w: hw, h: hh }, capacity);
    se = createQuadTree({ x: x + hw, y: y + hh, w: hw, h: hh }, capacity);
    divided = true;
  }

  function insert(point) {
    if (!contains(bounds, point)) return false;
    if (points.length < capacity) { points.push(point); return true; }
    if (!divided) subdivide();
    return nw.insert(point) || ne.insert(point) || sw.insert(point) || se.insert(point);
  }

  function query(range, found = []) {
    if (!intersects(bounds, range)) return found;
    for (const p of points) {
      if (contains(range, p)) found.push(p);
    }
    if (divided) {
      nw.query(range, found); ne.query(range, found);
      sw.query(range, found); se.query(range, found);
    }
    return found;
  }

  return { insert, query };
}
