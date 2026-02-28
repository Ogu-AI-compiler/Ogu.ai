/**
 * Max Flow — Ford-Fulkerson with BFS (Edmonds-Karp).
 */
export function maxFlow(network, source, sink) {
  const adj = network.getAdj();
  const nodes = network.getNodes();

  // Build residual graph
  const residual = new Map();
  for (const node of nodes) residual.set(node, new Map());

  for (const node of nodes) {
    for (const edge of (adj.get(node) || [])) {
      const cur = residual.get(node).get(edge.to) || 0;
      residual.get(node).set(edge.to, cur + edge.capacity);
      if (!residual.get(edge.to).has(node)) residual.get(edge.to).set(node, 0);
    }
  }

  let totalFlow = 0;

  while (true) {
    // BFS to find augmenting path
    const parent = {};
    const visited = new Set([source]);
    const queue = [source];
    let found = false;

    while (queue.length > 0 && !found) {
      const u = queue.shift();
      for (const [v, cap] of (residual.get(u) || new Map())) {
        if (!visited.has(v) && cap > 0) {
          visited.add(v);
          parent[v] = u;
          if (v === sink) { found = true; break; }
          queue.push(v);
        }
      }
    }

    if (!found) break;

    // Find bottleneck
    let pathFlow = Infinity;
    let v = sink;
    while (v !== source) {
      const u = parent[v];
      pathFlow = Math.min(pathFlow, residual.get(u).get(v));
      v = u;
    }

    // Update residual
    v = sink;
    while (v !== source) {
      const u = parent[v];
      residual.get(u).set(v, residual.get(u).get(v) - pathFlow);
      residual.get(v).set(u, (residual.get(v).get(u) || 0) + pathFlow);
      v = u;
    }

    totalFlow += pathFlow;
  }

  return totalFlow;
}
