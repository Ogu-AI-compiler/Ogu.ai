/**
 * Matrix Operations — basic matrix math.
 */
export function multiply(a, b) {
  const rows = a.length, cols = b[0].length, inner = b.length;
  const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++)
        result[i][j] += a[i][k] * b[k][j];
  return result;
}

export function transpose(m) {
  const rows = m.length, cols = m[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      result[j][i] = m[i][j];
  return result;
}

export function identity(n) {
  const result = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) result[i][i] = 1;
  return result;
}

export function add(a, b) {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

export function scale(m, s) {
  return m.map(row => row.map(v => v * s));
}
