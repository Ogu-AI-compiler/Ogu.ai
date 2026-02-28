/**
 * Dependency Graph Analyzer — build and analyze module dependency graphs.
 */

/**
 * Create a dependency graph.
 *
 * @returns {object} Graph with addNode/addEdge/getDependencies/getTransitiveDeps/getDependents/getNodes
 */
export function createDepGraph() {
  const nodes = new Set();
  const edges = new Map();   // from → Set(to)
  const reverse = new Map(); // to → Set(from)

  function addNode(name) {
    nodes.add(name);
    if (!edges.has(name)) edges.set(name, new Set());
    if (!reverse.has(name)) reverse.set(name, new Set());
  }

  function addEdge(from, to) {
    addNode(from);
    addNode(to);
    edges.get(from).add(to);
    reverse.get(to).add(from);
  }

  function getDependencies(name) {
    return Array.from(edges.get(name) || []);
  }

  function getTransitiveDeps(name, visited = new Set()) {
    const deps = [];
    for (const dep of getDependencies(name)) {
      if (visited.has(dep)) continue;
      visited.add(dep);
      deps.push(dep);
      deps.push(...getTransitiveDeps(dep, visited));
    }
    return deps;
  }

  function getDependents(name) {
    return Array.from(reverse.get(name) || []);
  }

  function getNodes() {
    return Array.from(nodes);
  }

  return { addNode, addEdge, getDependencies, getTransitiveDeps, getDependents, getNodes };
}
