/**
 * DBSCAN Clustering — density-based spatial clustering.
 */
export function dbscan(points, eps, minPts) {
  const n = points.length;
  const labels = new Array(n).fill(-1);
  let clusterId = 0;

  function dist(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }

  function regionQuery(idx) {
    const neighbors = [];
    for (let i = 0; i < n; i++) {
      if (dist(points[idx], points[i]) <= eps) neighbors.push(i);
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;
    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) { labels[i] = -2; continue; }
    labels[i] = clusterId;
    const queue = [...neighbors];
    while (queue.length > 0) {
      const j = queue.shift();
      if (labels[j] === -2) labels[j] = clusterId;
      if (labels[j] !== -1) continue;
      labels[j] = clusterId;
      const jNeighbors = regionQuery(j);
      if (jNeighbors.length >= minPts) queue.push(...jNeighbors);
    }
    clusterId++;
  }

  const clusters = [];
  for (let c = 0; c < clusterId; c++) {
    clusters.push(points.filter((_, i) => labels[i] === c));
  }
  const noise = points.filter((_, i) => labels[i] === -2);
  return { clusters, noise, labels };
}
