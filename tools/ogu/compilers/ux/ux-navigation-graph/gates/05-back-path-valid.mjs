/**
 * Gate UNG005 — back-path-valid
 * Every node that is NOT an entry point must have at least one incoming transition
 * from another node (i.e., at least one other node transitions to it).
 * Nodes with no incoming transitions and not an entry point are navigation dead-ends
 * that users cannot reach via back navigation.
 *
 * Escape hatch: node.deepLinkOnly = true (reachable only via deep link, not in-app navigation).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG005', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG005', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.entryPoints)) {
    return { pass: true, code: 'UNG005', message: 'Missing nodes or entryPoints — skipped', skipped: true };
  }

  // Build incoming-edge count per node
  const incomingCount = new Map();
  for (const node of spec.nodes) {
    if (typeof node.id === 'string') incomingCount.set(node.id, 0);
  }

  for (const node of spec.nodes) {
    if (!Array.isArray(node.transitions)) continue;
    for (const t of node.transitions) {
      if (typeof t.to === 'string' && incomingCount.has(t.to)) {
        incomingCount.set(t.to, incomingCount.get(t.to) + 1);
      }
    }
  }

  const entrySet = new Set(spec.entryPoints.filter(ep => typeof ep === 'string'));
  const violations = [];

  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (entrySet.has(node.id)) continue;
    if (node.deepLinkOnly === true) continue;
    if ((incomingCount.get(node.id) || 0) === 0) {
      violations.push(
        `Node "${node.id}" has no incoming transitions and is not an entry point ` +
        `(add a transition from another node, or set deepLinkOnly: true)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UNG005',
      message: `${violations.length} node(s) with no incoming path`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG005',
    message: 'back-path-valid: all non-entry nodes have at least one incoming transition',
  };
}
