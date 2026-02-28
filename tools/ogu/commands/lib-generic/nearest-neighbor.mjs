/**
 * Nearest Neighbor — find closest point(s) in a set.
 */
function dist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export function findNearest(target, points) {
  let best = null, bestDist = Infinity;
  for (const p of points) {
    const d = dist(target, p);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

export function findKNearest(target, points, k) {
  return [...points]
    .map(p => ({ point: p, dist: dist(target, p) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, k)
    .map(e => e.point);
}
