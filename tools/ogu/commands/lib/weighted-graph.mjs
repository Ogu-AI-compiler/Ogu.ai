/**
 * Weighted Graph — directed graph with edge weights.
 */
export function createWeightedGraph() {
  const adj = new Map();

  function ensureNode(node) { if (!adj.has(node)) adj.set(node, []); }

  function addEdge(from, to, weight) {
    ensureNode(from); ensureNode(to);
    adj.get(from).push({ to, weight });
  }

  function getEdges(node) { return adj.get(node) || []; }
  function getNodes() { return [...adj.keys()]; }

  return { addEdge, getEdges, getNodes };
}
