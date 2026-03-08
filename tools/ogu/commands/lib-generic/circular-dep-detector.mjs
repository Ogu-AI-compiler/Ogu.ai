/**
 * Circular Dependency Detector — detect and report cycles in dependency chains.
 */

/**
 * Detect cycles in a dependency graph.
 *
 * @param {Object<string, string[]>} edges - adjacency list
 * @returns {Array<string[]>} Array of cycle paths
 */
export function detectCycles(edges) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();
  const path = [];

  function dfs(node) {
    if (inStack.has(node)) {
      // Found cycle — extract it
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of (edges[node] || [])) {
      dfs(neighbor);
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of Object.keys(edges)) {
    dfs(node);
  }

  return cycles;
}
