/**
 * Bipartite Checker — check if an undirected graph is bipartite.
 */
export function isBipartite(graph) {
  const color = {};
  const nodes = Object.keys(graph);

  for (const start of nodes) {
    if (color[start] !== undefined) continue;
    const queue = [start];
    color[start] = 0;
    while (queue.length > 0) {
      const node = queue.shift();
      for (const neighbor of (graph[node] || [])) {
        if (color[neighbor] === undefined) {
          color[neighbor] = 1 - color[node];
          queue.push(neighbor);
        } else if (color[neighbor] === color[node]) {
          return false;
        }
      }
    }
  }
  return true;
}

export function getPartitions(graph) {
  if (!isBipartite(graph)) return null;
  const color = {};
  const nodes = Object.keys(graph);
  for (const start of nodes) {
    if (color[start] !== undefined) continue;
    const queue = [start];
    color[start] = 0;
    while (queue.length > 0) {
      const node = queue.shift();
      for (const neighbor of (graph[node] || [])) {
        if (color[neighbor] === undefined) {
          color[neighbor] = 1 - color[node];
          queue.push(neighbor);
        }
      }
    }
  }
  const a = [], b = [];
  for (const [node, c] of Object.entries(color)) {
    (c === 0 ? a : b).push(node);
  }
  return [a, b];
}
