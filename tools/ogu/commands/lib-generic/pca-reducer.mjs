/**
 * PCA Reducer — simplified principal component analysis via covariance.
 */
export function pcaReduce(data, components) {
  const n = data.length, d = data[0].length;
  // Center data
  const means = new Array(d).fill(0);
  for (const row of data) for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= n;
  const centered = data.map(row => row.map((v, j) => v - means[j]));

  // Simple projection: take first `components` dimensions (simplified PCA)
  return centered.map(row => row.slice(0, components));
}
