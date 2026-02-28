/**
 * Sparse Matrix — store only non-zero values.
 */
export function createSparseMatrix() {
  const data = new Map();

  function key(r, c) { return `${r},${c}`; }

  function set(row, col, value) {
    if (value === 0) { data.delete(key(row, col)); return; }
    data.set(key(row, col), value);
  }

  function get(row, col) {
    return data.get(key(row, col)) || 0;
  }

  function getNonZeroCount() { return data.size; }

  function toArray(rows, cols) {
    const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (const [k, v] of data) {
      const [r, c] = k.split(",").map(Number);
      if (r < rows && c < cols) result[r][c] = v;
    }
    return result;
  }

  return { set, get, getNonZeroCount, toArray };
}
