/**
 * Minimum Spanning Tree — Kruskal's algorithm.
 */
export function kruskal(nodes, edges) {
  const parent = {};
  const rank = {};
  for (const n of nodes) { parent[n] = n; rank[n] = 0; }

  function find(x) {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x, y) {
    const rx = find(x), ry = find(y);
    if (rx === ry) return false;
    if (rank[rx] < rank[ry]) parent[rx] = ry;
    else if (rank[rx] > rank[ry]) parent[ry] = rx;
    else { parent[ry] = rx; rank[rx]++; }
    return true;
  }

  const sorted = [...edges].sort((a, b) => a.w - b.w);
  const mst = [];
  for (const edge of sorted) {
    if (union(edge.u, edge.v)) mst.push(edge);
  }
  return mst;
}
