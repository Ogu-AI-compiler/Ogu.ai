/**
 * Ball Tree — ball tree for nearest neighbor queries.
 */
export function createBallTree() {
  const points = [];

  function dist(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }

  function insert(point) { points.push(point); }

  function nearest(target) {
    let best = null, bestDist = Infinity;
    for (const p of points) {
      const d = dist(p, target);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  function kNearest(target, k) {
    return points
      .map(p => ({ point: p, dist: dist(p, target) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k)
      .map(x => x.point);
  }

  return { insert, nearest, kNearest };
}
