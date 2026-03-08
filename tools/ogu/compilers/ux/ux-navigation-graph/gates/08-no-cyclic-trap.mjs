/**
 * Gate UNG008 — no-cyclic-trap
 * Detects strongly connected components (SCCs) where every path
 * through the cycle has no exit to a terminal or non-cycle node.
 * A cyclic trap is a set of nodes where the user can navigate in circles
 * with no way to leave — a navigation dead-end even though nodes are reachable.
 *
 * Uses Tarjan's SCC algorithm. SCCs of size > 1 with no outgoing edges
 * to non-SCC nodes are reported as traps.
 *
 * Escape hatch: node.cyclicOk = true on any node in the SCC exempts the component.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function tarjanSCC(nodes) {
  const ids = new Map();
  const low = new Map();
  const onStack = new Map();
  const stack = [];
  const sccs = [];
  let index = 0;

  // Build adjacency
  const adj = new Map();
  for (const node of nodes) {
    if (typeof node.id !== 'string') continue;
    const targets = [];
    if (Array.isArray(node.transitions)) {
      for (const t of node.transitions) {
        if (typeof t.to === 'string') targets.push(t.to);
      }
    }
    adj.set(node.id, targets);
  }

  function strongConnect(v) {
    ids.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.set(v, true);

    for (const w of (adj.get(v) || [])) {
      if (!ids.has(w)) {
        strongConnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.get(w)) {
        low.set(v, Math.min(low.get(v), ids.get(w)));
      }
    }

    if (low.get(v) === ids.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.set(w, false);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const node of nodes) {
    if (typeof node.id === 'string' && !ids.has(node.id)) {
      strongConnect(node.id);
    }
  }

  return { sccs, adj };
}

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG008', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG008', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'UNG008', message: 'No nodes to check — skipped', skipped: true };
  }

  // Build escape-hatch lookup
  const cyclicOkNodes = new Set(
    spec.nodes.filter(n => n.cyclicOk === true).map(n => n.id)
  );

  const { sccs, adj } = tarjanSCC(spec.nodes);
  const sccSet = new Map();
  for (const scc of sccs) {
    for (const nodeId of scc) sccSet.set(nodeId, scc);
  }

  const traps = [];
  for (const scc of sccs) {
    if (scc.length <= 1) continue;
    // Check if any node in SCC has cyclicOk
    if (scc.some(id => cyclicOkNodes.has(id))) continue;
    // Check if there is any outgoing edge from any SCC node to a node OUTSIDE the SCC
    const sccMembers = new Set(scc);
    let hasExit = false;
    for (const nodeId of scc) {
      for (const target of (adj.get(nodeId) || [])) {
        if (!sccMembers.has(target)) {
          hasExit = true;
          break;
        }
      }
      if (hasExit) break;
    }
    if (!hasExit) {
      traps.push(`Cyclic trap detected: nodes [${scc.join(', ')}] form a closed cycle with no exit`);
    }
  }

  if (traps.length > 0) {
    return {
      pass: false,
      code: 'UNG008',
      message: `${traps.length} cyclic trap(s) detected`,
      detail: traps.join('\n') + '\nTip: Add an exit transition to a node outside the cycle, or set cyclicOk: true on a node in the cycle.',
    };
  }

  return {
    pass: true,
    code: 'UNG008',
    message: 'no-cyclic-trap: no closed navigation traps detected',
  };
}
