/**
 * Gate UXF007 — finite-paths
 * Every path from an entry node must eventually reach a terminal node.
 * Uses cycle detection: if a strongly connected component has no exit
 * to a terminal, paths through it are infinite and must be rejected.
 *
 * Implementation: for each entry node, perform DFS. If we reach a node
 * we've visited in the current path (cycle) and cannot exit to a terminal,
 * report the cycle as an infinite path.
 *
 * Escape hatch: node.cyclicOk = true for intentional loops (e.g., wizard retry).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF007', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF007', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.edges)) {
    return { pass: true, code: 'UXF007', message: 'Missing nodes or edges — skipped', skipped: true };
  }

  const terminalSet = new Set(Array.isArray(spec.terminals) ? spec.terminals : []);
  const cyclicOkSet = new Set(
    spec.nodes.filter(n => n.cyclicOk === true).map(n => n.id)
  );

  // Build adjacency
  const adj = new Map();
  for (const node of spec.nodes) {
    if (typeof node.id === 'string') adj.set(node.id, []);
  }
  for (const edge of spec.edges) {
    if (typeof edge.from === 'string' && typeof edge.to === 'string') {
      const targets = adj.get(edge.from);
      if (targets) targets.push(edge.to);
    }
  }

  // Check if there is any path from nodeId to a terminal, given a visited set
  // Returns false if stuck in cycle with no exit
  const canReachTerminal = new Map(); // cache: nodeId -> boolean

  function canReach(nodeId, pathStack) {
    if (terminalSet.has(nodeId)) return true;
    if (canReachTerminal.has(nodeId)) return canReachTerminal.get(nodeId);
    if (cyclicOkSet.has(nodeId)) return true; // exempt

    if (pathStack.has(nodeId)) {
      // We're in a cycle
      return false;
    }

    pathStack.add(nodeId);
    const targets = adj.get(nodeId) || [];
    let result = false;
    for (const target of targets) {
      if (canReach(target, pathStack)) {
        result = true;
        break;
      }
    }
    pathStack.delete(nodeId);

    canReachTerminal.set(nodeId, result);
    return result;
  }

  const violations = [];
  const entryNodes = Array.isArray(spec.entryNodes) ? spec.entryNodes : [];

  for (const entryId of entryNodes) {
    if (!canReach(entryId, new Set())) {
      violations.push(`Entry node "${entryId}" has a path with no route to any terminal node (infinite loop)`);
    }
  }

  // Also check for any non-terminal node that can't reach a terminal
  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (terminalSet.has(node.id)) continue;
    if (cyclicOkSet.has(node.id)) continue;
    if (!canReach(node.id, new Set())) {
      violations.push(
        `Node "${node.id}" cannot reach any terminal node (add cyclicOk: true if this is intentional)`
      );
    }
  }

  // Deduplicate violations
  const unique = [...new Set(violations)];

  if (unique.length > 0) {
    return {
      pass: false,
      code: 'UXF007',
      message: `${unique.length} infinite path(s) detected`,
      detail: unique.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF007',
    message: 'finite-paths: all paths lead to terminal nodes',
  };
}
