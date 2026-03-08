/**
 * Gate UXF005 — decision-branches
 * Every node with type === "decision" must have at least 2 outgoing edges.
 * A decision node with only 1 outgoing edge is not a real decision — it's a passthrough
 * that can be simplified, or the second branch is missing (undefined UX path).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF005', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF005', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.edges)) {
    return { pass: true, code: 'UXF005', message: 'Missing nodes or edges — skipped', skipped: true };
  }

  const decisionNodes = spec.nodes.filter(n => n.type === 'decision');
  if (decisionNodes.length === 0) {
    return { pass: true, code: 'UXF005', message: 'No decision nodes found — skipped', skipped: true };
  }

  // Count outgoing edges per decision node
  const outgoing = new Map();
  for (const node of decisionNodes) outgoing.set(node.id, 0);

  for (const edge of spec.edges) {
    if (typeof edge.from === 'string' && outgoing.has(edge.from)) {
      outgoing.set(edge.from, outgoing.get(edge.from) + 1);
    }
  }

  const violations = [];
  for (const node of decisionNodes) {
    const count = outgoing.get(node.id) || 0;
    if (count < 2) {
      violations.push(
        `Decision node "${node.id}" has only ${count} outgoing edge(s) — decisions require at least 2 branches`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF005',
      message: `${violations.length} decision node(s) with insufficient branches`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF005',
    message: `decision-branches: all ${decisionNodes.length} decision node(s) have ≥2 outgoing edges`,
  };
}
