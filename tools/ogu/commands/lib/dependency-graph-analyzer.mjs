/**
 * Dependency Graph Analyzer — analyze graph structure, depth, roots, leaves.
 */
export function createDepGraphAnalyzer() {
  const edges = new Map(); // node → Set<dependency>
  const allNodes = new Set();

  function addEdge(from, to) {
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from).add(to);
    allNodes.add(from);
    allNodes.add(to);
  }

  function getDepth(node, visited = new Set()) {
    const deps = edges.get(node);
    if (!deps || deps.size === 0) return 0;
    if (visited.has(node)) return 0;
    visited.add(node);
    let maxDepth = 0;
    for (const dep of deps) {
      maxDepth = Math.max(maxDepth, 1 + getDepth(dep, visited));
    }
    return maxDepth;
  }

  function getLeaves() {
    return Array.from(allNodes).filter(n => !edges.has(n) || edges.get(n).size === 0);
  }

  function getRoots() {
    const dependedOn = new Set();
    for (const deps of edges.values()) {
      for (const d of deps) dependedOn.add(d);
    }
    return Array.from(allNodes).filter(n => !dependedOn.has(n));
  }

  return { addEdge, getDepth, getLeaves, getRoots };
}
