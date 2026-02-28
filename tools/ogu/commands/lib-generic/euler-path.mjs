/**
 * Euler Path — check for Eulerian paths and circuits.
 */
export function hasEulerianPath(graph) {
  const degrees = {};
  for (const [node, neighbors] of Object.entries(graph)) {
    if (!degrees[node]) degrees[node] = 0;
    degrees[node] += neighbors.length;
    for (const n of neighbors) {
      if (!degrees[n]) degrees[n] = 0;
    }
  }
  // Count odd-degree vertices (undirected: each edge counted from both sides)
  let oddCount = 0;
  for (const d of Object.values(degrees)) {
    if (d % 2 !== 0) oddCount++;
  }
  return oddCount === 0 || oddCount === 2;
}

export function hasEulerianCircuit(graph) {
  const degrees = {};
  for (const [node, neighbors] of Object.entries(graph)) {
    if (!degrees[node]) degrees[node] = 0;
    degrees[node] += neighbors.length;
    for (const n of neighbors) {
      if (!degrees[n]) degrees[n] = 0;
    }
  }
  for (const d of Object.values(degrees)) {
    if (d % 2 !== 0) return false;
  }
  return true;
}
