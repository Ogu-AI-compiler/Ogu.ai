/**
 * Topology Sorter — topological sort with layer detection.
 */

export function topoSort({ edges }) {
  const adj = new Map();
  const inDeg = new Map();
  const nodes = new Set();

  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
    if (!inDeg.has(from)) inDeg.set(from, 0);
  }

  const queue = [];
  for (const n of nodes) {
    if (!inDeg.has(n) || inDeg.get(n) === 0) queue.push(n);
  }

  const sorted = [];
  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);
    for (const next of (adj.get(node) || [])) {
      inDeg.set(next, inDeg.get(next) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  if (sorted.length !== nodes.size) {
    return { hasCycle: true, sorted: null };
  }

  return { hasCycle: false, sorted };
}

export function getLayers({ edges }) {
  const adj = new Map();
  const inDeg = new Map();
  const nodes = new Set();

  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
    if (!inDeg.has(from)) inDeg.set(from, 0);
  }

  const layers = [];
  let queue = [];
  for (const n of nodes) {
    if (!inDeg.has(n) || inDeg.get(n) === 0) queue.push(n);
  }

  while (queue.length > 0) {
    layers.push([...queue]);
    const nextQueue = [];
    for (const node of queue) {
      for (const next of (adj.get(node) || [])) {
        inDeg.set(next, inDeg.get(next) - 1);
        if (inDeg.get(next) === 0) nextQueue.push(next);
      }
    }
    queue = nextQueue;
  }

  return layers;
}
