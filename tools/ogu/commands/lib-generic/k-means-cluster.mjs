/**
 * K-Means Clustering — partition points into k clusters.
 */
export function kMeans(points, k, maxIter = 100) {
  const dim = points[0].length;
  let centroids = points.slice(0, k).map(p => [...p]);
  let assignments = new Array(points.length).fill(0);

  function dist(a, b) {
    let sum = 0;
    for (let i = 0; i < dim; i++) sum += (a[i] - b[i]) ** 2;
    return Math.sqrt(sum);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < points.length; i++) {
      let minD = Infinity, minC = 0;
      for (let c = 0; c < k; c++) {
        const d = dist(points[i], centroids[c]);
        if (d < minD) { minD = d; minC = c; }
      }
      assignments[i] = minC;
    }
    const newCentroids = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < points.length; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let d = 0; d < dim; d++) newCentroids[c][d] += points[i][d];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) for (let d = 0; d < dim; d++) newCentroids[c][d] /= counts[c];
    }
    centroids = newCentroids;
  }

  const clusters = Array.from({ length: k }, (_, i) => points.filter((_, j) => assignments[j] === i));
  return { clusters, assignments, centroids };
}
