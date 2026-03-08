/**
 * Gate UXF004 — no-orphan-nodes
 * Every node must be reachable from at least one entry node by following edges.
 * Unreachable nodes cannot be encountered by real users.
 * Uses BFS from all entryNodes.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function buildReachableSet(nodes, edges, entryNodes) {
  const adj = new Map();
  for (const node of nodes) {
    if (typeof node.id === 'string') adj.set(node.id, []);
  }
  for (const edge of edges) {
    if (typeof edge.from === 'string' && typeof edge.to === 'string') {
      const targets = adj.get(edge.from);
      if (targets) targets.push(edge.to);
    }
  }

  const reachable = new Set();
  const queue = [...entryNodes.filter(id => typeof id === 'string')];
  for (const ep of queue) reachable.add(ep);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const target of (adj.get(current) || [])) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  return reachable;
}

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF004', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF004', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.edges) || !Array.isArray(spec.entryNodes)) {
    return { pass: true, code: 'UXF004', message: 'Missing nodes/edges/entryNodes — skipped', skipped: true };
  }

  const reachable = buildReachableSet(spec.nodes, spec.edges, spec.entryNodes);
  const violations = [];

  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (node.reachabilityExempt === true) continue;
    if (!reachable.has(node.id)) {
      violations.push(`Node "${node.id}" (type="${node.type}") is unreachable from all entry nodes`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF004',
      message: `${violations.length} unreachable (orphan) node(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF004',
    message: `no-orphan-nodes: all ${spec.nodes.length} node(s) are reachable`,
  };
}
