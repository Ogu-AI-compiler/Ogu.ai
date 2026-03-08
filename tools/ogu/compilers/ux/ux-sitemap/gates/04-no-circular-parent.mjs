/**
 * Gate USM004 — no-circular-parent
 * Following parent references must never form a cycle.
 * A → B → C → A is a cycle and must be rejected.
 * Uses iterative DFS with a visited/stack set.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function buildParentMap(nodes) {
  const map = new Map();
  for (const node of nodes) {
    if (typeof node.id === 'string') {
      map.set(node.id, node.parent || null);
    }
  }
  return map;
}

function detectCycle(startId, parentMap) {
  const visited = new Set();
  let current = startId;
  while (current !== null && current !== undefined) {
    if (visited.has(current)) {
      return true;
    }
    visited.add(current);
    current = parentMap.get(current);
  }
  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM004', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM004', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM004', message: 'No nodes to check — skipped', skipped: true };
  }

  const parentMap = buildParentMap(spec.nodes);
  const violations = [];

  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (detectCycle(node.id, parentMap)) {
      violations.push(`Circular parent reference detected starting from node "${node.id}"`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USM004',
      message: `${violations.length} circular parent reference(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM004',
    message: 'no-circular-parent: sitemap is a valid DAG (no cycles)',
  };
}
