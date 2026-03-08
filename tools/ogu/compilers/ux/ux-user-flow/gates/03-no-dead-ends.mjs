/**
 * Gate UXF003 — no-dead-ends
 * Every node that is NOT a terminal must have at least one outgoing edge.
 * A non-terminal node with zero outgoing edges is a dead end — the user is stuck.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF003', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF003', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.edges)) {
    return { pass: true, code: 'UXF003', message: 'Missing nodes or edges — skipped', skipped: true };
  }

  const terminalSet = new Set(Array.isArray(spec.terminals) ? spec.terminals : []);

  // Count outgoing edges per node
  const outgoing = new Map();
  for (const node of spec.nodes) {
    if (typeof node.id === 'string') outgoing.set(node.id, 0);
  }
  for (const edge of spec.edges) {
    if (typeof edge.from === 'string' && outgoing.has(edge.from)) {
      outgoing.set(edge.from, outgoing.get(edge.from) + 1);
    }
  }

  const violations = [];
  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (terminalSet.has(node.id)) continue;
    if (node.type === 'terminal') continue;
    if ((outgoing.get(node.id) || 0) === 0) {
      violations.push(
        `Node "${node.id}" (type="${node.type}") is not a terminal but has no outgoing edges — dead end`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF003',
      message: `${violations.length} dead-end node(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF003',
    message: 'no-dead-ends: all non-terminal nodes have outgoing edges',
  };
}
