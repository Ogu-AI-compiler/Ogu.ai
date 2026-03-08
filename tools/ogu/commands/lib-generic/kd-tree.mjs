/**
 * KD-Tree — k-dimensional tree for spatial queries.
 */
export function createKDTree(k) {
  const points = [];

  function dist(a, b) {
    let sum = 0;
    for (let i = 0; i < k; i++) sum += (a[i] - b[i]) ** 2;
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

  function rangeSearch(lo, hi) {
    return points.filter(p => {
      for (let i = 0; i < k; i++) {
        if (p[i] < lo[i] || p[i] > hi[i]) return false;
      }
      return true;
    });
  }

  return { insert, nearest, rangeSearch };
}
