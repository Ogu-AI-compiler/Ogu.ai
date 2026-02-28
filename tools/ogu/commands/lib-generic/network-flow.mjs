/**
 * Network Flow — flow network data structure.
 */
export function createFlowNetwork() {
  const adj = new Map();

  function ensureNode(node) { if (!adj.has(node)) adj.set(node, []); }

  function addEdge(from, to, capacity) {
    ensureNode(from); ensureNode(to);
    adj.get(from).push({ to, capacity, flow: 0 });
  }

  function getEdges(node) { return adj.get(node) || []; }
  function getNodes() { return [...adj.keys()]; }

  function getAdj() { return adj; }

  return { addEdge, getEdges, getNodes, getAdj };
}
