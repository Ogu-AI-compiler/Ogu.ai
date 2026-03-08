/**
 * A-Star Search — A* pathfinding on weighted graphs.
 */
export function astar(graph, start, goal, heuristic) {
  const open = [{ node: start, g: 0, f: heuristic(start) }];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(start, 0);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    if (current.node === goal) {
      const path = [goal];
      let n = goal;
      while (cameFrom.has(n)) { n = cameFrom.get(n); path.unshift(n); }
      return path;
    }
    for (const edge of (graph[current.node] || [])) {
      const tentG = current.g + edge.cost;
      if (!gScore.has(edge.to) || tentG < gScore.get(edge.to)) {
        gScore.set(edge.to, tentG);
        cameFrom.set(edge.to, current.node);
        open.push({ node: edge.to, g: tentG, f: tentG + heuristic(edge.to) });
      }
    }
  }
  return null;
}
