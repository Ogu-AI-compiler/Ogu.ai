/**
 * Polynomial Fit — least squares polynomial regression.
 */
export function polynomialFit(x, y, degree) {
  const n = x.length;
  const m = degree + 1;
  const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < n; k++) A[i][j] += Math.pow(x[k], i + j);
    }
    for (let k = 0; k < n; k++) A[i][m] += y[k] * Math.pow(x[k], i);
  }

  // Gaussian elimination
  for (let i = 0; i < m; i++) {
    let maxRow = i;
    for (let k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    for (let k = i + 1; k < m; k++) {
      const f = A[k][i] / A[i][i];
      for (let j = i; j <= m; j++) A[k][j] -= f * A[i][j];
    }
  }

  const coefficients = new Array(m);
  for (let i = m - 1; i >= 0; i--) {
    coefficients[i] = A[i][m];
    for (let j = i + 1; j < m; j++) coefficients[i] -= A[i][j] * coefficients[j];
    coefficients[i] /= A[i][i];
  }

  function predict(val) {
    let sum = 0;
    for (let i = 0; i < m; i++) sum += coefficients[i] * Math.pow(val, i);
    return sum;
  }

  return { coefficients, predict };
}
