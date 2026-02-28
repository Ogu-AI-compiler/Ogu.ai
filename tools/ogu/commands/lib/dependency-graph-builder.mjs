/**
 * Dependency Graph Builder — build directed dependency graphs.
 */
export function createDependencyGraphBuilder() {
  const nodes = new Map();
  function addNode(id, data = {}) { nodes.set(id, { data, deps: new Set() }); }
  function addDependency(from, to) {
    if (!nodes.has(from)) addNode(from);
    if (!nodes.has(to)) addNode(to);
    nodes.get(from).deps.add(to);
  }
  function getDependencies(id) { const n = nodes.get(id); return n ? [...n.deps] : []; }
  function getDependents(id) {
    const result = [];
    for (const [nid, node] of nodes) { if (node.deps.has(id)) result.push(nid); }
    return result;
  }
  function getNodes() { return [...nodes.keys()]; }
  function toAdjacencyList() {
    const adj = {};
    for (const [id, node] of nodes) adj[id] = [...node.deps];
    return adj;
  }
  return { addNode, addDependency, getDependencies, getDependents, getNodes, toAdjacencyList };
}
