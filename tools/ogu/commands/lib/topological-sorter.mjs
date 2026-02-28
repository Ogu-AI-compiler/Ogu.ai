/**
 * Topological Sorter — topological sort using Kahn's algorithm.
 */
export function topologicalSort(adjacencyList) {
  const inDegree = {};
  const nodes = Object.keys(adjacencyList);
  for (const n of nodes) inDegree[n] = 0;
  for (const n of nodes) {
    for (const dep of adjacencyList[n]) {
      inDegree[dep] = (inDegree[dep] || 0) + 1;
    }
  }
  const queue = nodes.filter(n => inDegree[n] === 0);
  const result = [];
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    for (const dep of adjacencyList[node]) {
      inDegree[dep]--;
      if (inDegree[dep] === 0) queue.push(dep);
    }
  }
  if (result.length !== nodes.length) return null;
  return result;
}
