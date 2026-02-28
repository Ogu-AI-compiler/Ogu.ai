/**
 * Graph Cycle Finder — detect cycles in directed graphs.
 */
export function findCycles(adjacencyList) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  const cycles = [];
  const path = [];
  for (const node of Object.keys(adjacencyList)) color[node] = WHITE;
  function dfs(u) {
    color[u] = GRAY;
    path.push(u);
    for (const v of (adjacencyList[u] || [])) {
      if (color[v] === GRAY) {
        const cycleStart = path.indexOf(v);
        cycles.push(path.slice(cycleStart));
      } else if (color[v] === WHITE) {
        dfs(v);
      }
    }
    path.pop();
    color[u] = BLACK;
  }
  for (const node of Object.keys(adjacencyList)) {
    if (color[node] === WHITE) dfs(node);
  }
  return cycles;
}

export function hasCycle(adjacencyList) {
  return findCycles(adjacencyList).length > 0;
}
