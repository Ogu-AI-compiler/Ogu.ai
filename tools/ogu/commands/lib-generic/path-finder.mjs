/**
 * Path Finder — shortest path and all-paths in adjacency-list graphs.
 */
export function findPath(graph, start, end) {
  const visited = new Set();
  const queue = [[start]];
  visited.add(start);
  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === end) return path;
    for (const neighbor of (graph[node] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

export function findAllPaths(graph, start, end) {
  const results = [];
  function dfs(node, path, visited) {
    if (node === end) { results.push([...path]); return; }
    for (const neighbor of (graph[node] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        path.push(neighbor);
        dfs(neighbor, path, visited);
        path.pop();
        visited.delete(neighbor);
      }
    }
  }
  const visited = new Set([start]);
  dfs(start, [start], visited);
  return results;
}
