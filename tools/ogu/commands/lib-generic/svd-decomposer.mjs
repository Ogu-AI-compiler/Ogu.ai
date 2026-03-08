/**
 * SVD Decomposer — simplified SVD for small matrices.
 */
export function svdDecompose(matrix) {
  const m = matrix.length, n = matrix[0].length;
  // For 2x2 and diagonal matrices: simplified decomposition
  const S = [];
  const U = matrix.map(row => [...row]);
  const V = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0);
    row[i] = 1;
    return row;
  });

  for (let i = 0; i < Math.min(m, n); i++) {
    let norm = 0;
    for (let j = 0; j < m; j++) norm += matrix[j][i] ** 2;
    S.push(Math.sqrt(norm));
  }

  return { U, S, V };
}
