/**
 * Exact Cover — solve exact cover problem using backtracking.
 */
export function solveExactCover(matrix) {
  const numCols = matrix[0].length;
  const covered = new Set();
  const solution = [];

  function solve() {
    if (covered.size === numCols) return true;
    let col = -1;
    for (let c = 0; c < numCols; c++) {
      if (!covered.has(c)) { col = c; break; }
    }
    if (col === -1) return false;
    for (let r = 0; r < matrix.length; r++) {
      if (matrix[r][col] !== 1) continue;
      const rowCols = [];
      for (let c = 0; c < numCols; c++) {
        if (matrix[r][c] === 1) rowCols.push(c);
      }
      if (rowCols.some(c => covered.has(c))) continue;
      solution.push(r);
      for (const c of rowCols) covered.add(c);
      if (solve()) return true;
      solution.pop();
      for (const c of rowCols) covered.delete(c);
    }
    return false;
  }

  return solve() ? [...solution] : null;
}
