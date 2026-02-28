/**
 * Line Intersection — find intersection of two line segments.
 */
export function intersect(p1, p2, p3, p4) {
  const [x1, y1] = p1, [x2, y2] = p2;
  const [x3, y3] = p3, [x4, y4] = p4;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const x = x1 + t * (x2 - x1);
  const y = y1 + t * (y2 - y1);
  return [x, y];
}
