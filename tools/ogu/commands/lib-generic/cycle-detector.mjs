/**
 * Cycle Detector — detect cycles in directed graphs.
 */

/**
 * Detect cycles using DFS with coloring.
 *
 * @param {object} opts - { edges: Array<[from, to]> }
 * @returns {Array} Array of cycles found (each cycle is an array of nodes)
 */
export function detectCycles({ edges }) {
  const adj = new Map();
  for (const [from, to] of edges) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const cycles = [];

  for (const node of adj.keys()) {
    if (!color.has(node)) color.set(node, WHITE);
  }

  function dfs(node, path) {
    color.set(node, GRAY);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (!color.has(next)) color.set(next, WHITE);

      if (color.get(next) === GRAY) {
        // Found a cycle
        const cycleStart = path.indexOf(next);
        cycles.push(path.slice(cycleStart));
      } else if (color.get(next) === WHITE) {
        dfs(next, path);
      }
    }

    path.pop();
    color.set(node, BLACK);
  }

  for (const node of adj.keys()) {
    if (color.get(node) === WHITE) {
      dfs(node, []);
    }
  }

  return cycles;
}
