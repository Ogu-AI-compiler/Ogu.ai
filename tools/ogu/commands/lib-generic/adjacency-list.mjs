/**
 * Adjacency List — graph representation using neighbor lists.
 */
export function createAdjacencyList() {
  const adj = new Map();

  function ensureNode(node) { if (!adj.has(node)) adj.set(node, []); }

  function addEdge(from, to) {
    ensureNode(from); ensureNode(to);
    adj.get(from).push(to);
  }

  function getNeighbors(node) { return adj.get(node) || []; }
  function hasEdge(from, to) { return (adj.get(from) || []).includes(to); }
  function getNodes() { return [...adj.keys()]; }

  return { addEdge, getNeighbors, hasEdge, getNodes };
}
