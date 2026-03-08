import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'routing-spec.json'), 'utf8'));

  // Build redirect graph
  function collectRedirects(routes, graph = {}) {
    for (const route of routes) {
      if (route.redirect) {
        graph[route.path] = route.redirect;
      }
      if (route.children) collectRedirects(route.children, graph);
    }
    return graph;
  }

  const graph = collectRedirects(spec.routes);

  // Detect cycles using DFS
  const cycles = [];
  for (const start of Object.keys(graph)) {
    const visited = new Set();
    let current = start;
    while (current && graph[current]) {
      if (visited.has(current)) {
        cycles.push(`Cyclic redirect: ${Array.from(visited).join(' → ')} → ${current}`);
        break;
      }
      visited.add(current);
      current = graph[current];
    }
  }

  if (cycles.length) {
    return { pass: false, code: 'RC005', message: `Cyclic redirects found (${cycles.length})`, detail: cycles.join('\n') };
  }

  return { pass: true, code: 'RC005', message: `No cyclic redirects — ${Object.keys(graph).length} redirects checked` };
}
