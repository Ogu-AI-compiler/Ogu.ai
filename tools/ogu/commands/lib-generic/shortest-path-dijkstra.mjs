/**
 * Shortest Path — Dijkstra's algorithm.
 */
export function dijkstra(graph, source) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const nodes = Object.keys(graph);

  for (const n of nodes) { dist[n] = Infinity; prev[n] = null; }
  dist[source] = 0;

  while (visited.size < nodes.length) {
    let u = null;
    for (const n of nodes) {
      if (!visited.has(n) && (u === null || dist[n] < dist[u])) u = n;
    }
    if (u === null || dist[u] === Infinity) break;
    visited.add(u);
    for (const { to, w } of (graph[u] || [])) {
      const alt = dist[u] + w;
      if (alt < dist[to]) { dist[to] = alt; prev[to] = u; }
    }
  }

  return dist;
}

export function getPath(graph, source, target) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const nodes = Object.keys(graph);

  for (const n of nodes) { dist[n] = Infinity; prev[n] = null; }
  dist[source] = 0;

  while (visited.size < nodes.length) {
    let u = null;
    for (const n of nodes) {
      if (!visited.has(n) && (u === null || dist[n] < dist[u])) u = n;
    }
    if (u === null || dist[u] === Infinity) break;
    visited.add(u);
    for (const { to, w } of (graph[u] || [])) {
      const alt = dist[u] + w;
      if (alt < dist[to]) { dist[to] = alt; prev[to] = u; }
    }
  }

  if (dist[target] === Infinity) return null;
  const path = [];
  let curr = target;
  while (curr !== null) { path.unshift(curr); curr = prev[curr]; }
  return path;
}
