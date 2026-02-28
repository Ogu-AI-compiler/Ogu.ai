/**
 * Graph Coloring — greedy coloring algorithm.
 */
export function greedyColoring(graph) {
  const colors = {};
  const nodes = Object.keys(graph);

  for (const node of nodes) {
    const usedColors = new Set();
    for (const neighbor of (graph[node] || [])) {
      if (colors[neighbor] !== undefined) usedColors.add(colors[neighbor]);
    }
    let color = 0;
    while (usedColors.has(color)) color++;
    colors[node] = color;
  }

  return colors;
}
