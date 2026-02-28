/**
 * Graph Traversal — BFS and DFS for adjacency-list graphs.
 */
export function bfs(graph, start) {
  const visited = new Set();
  const queue = [start];
  const result = [];
  visited.add(start);
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    for (const neighbor of (graph[node] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return result;
}

export function dfs(graph, start) {
  const visited = new Set();
  const result = [];
  function visit(node) {
    if (visited.has(node)) return;
    visited.add(node);
    result.push(node);
    for (const neighbor of (graph[node] || [])) {
      visit(neighbor);
    }
  }
  visit(start);
  return result;
}
