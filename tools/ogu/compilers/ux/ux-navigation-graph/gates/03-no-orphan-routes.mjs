/**
 * Gate UNG003 — no-orphan-routes
 * Every node must be reachable from at least one entry point
 * by following transitions. Unreachable nodes are orphans.
 * Uses BFS from all entry points.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function buildReachableSet(nodes, entryPoints) {
  // Build adjacency map: nodeId -> [targetNodeId, ...]
  const adjacency = new Map();
  for (const node of nodes) {
    if (typeof node.id !== 'string') continue;
    const targets = [];
    if (Array.isArray(node.transitions)) {
      for (const t of node.transitions) {
        if (typeof t.to === 'string') targets.push(t.to);
      }
    }
    adjacency.set(node.id, targets);
  }

  const reachable = new Set();
  const queue = [...entryPoints.filter(ep => typeof ep === 'string')];
  for (const ep of queue) reachable.add(ep);

  while (queue.length > 0) {
    const current = queue.shift();
    const targets = adjacency.get(current) || [];
    for (const target of targets) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  return reachable;
}

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG003', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG003', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.entryPoints)) {
    return { pass: true, code: 'UNG003', message: 'Missing nodes or entryPoints — skipped', skipped: true };
  }

  const reachable = buildReachableSet(spec.nodes, spec.entryPoints);
  const violations = [];

  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    // Nodes explicitly marked as utility/modal may be mounted without navigation
    if (node.reachabilityExempt === true) continue;
    if (!reachable.has(node.id)) {
      violations.push(`Node "${node.id}" is unreachable from all entry points`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UNG003',
      message: `${violations.length} unreachable (orphan) node(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG003',
    message: `no-orphan-routes: all ${spec.nodes.length} node(s) are reachable`,
  };
}
