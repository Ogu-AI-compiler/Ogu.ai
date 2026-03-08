/**
 * Adjacency Matrix — graph representation using 2D matrix.
 */
export function createAdjacencyMatrix(n) {
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  function addEdge(from, to, weight = 1) { matrix[from][to] = weight; }
  function removeEdge(from, to) { matrix[from][to] = 0; }
  function hasEdge(from, to) { return matrix[from][to] !== 0; }

  function getNeighbors(node) {
    const neighbors = [];
    for (let i = 0; i < n; i++) {
      if (matrix[node][i] !== 0) neighbors.push(i);
    }
    return neighbors;
  }

  function getMatrix() { return matrix.map(row => [...row]); }

  return { addEdge, removeEdge, hasEdge, getNeighbors, getMatrix };
}
