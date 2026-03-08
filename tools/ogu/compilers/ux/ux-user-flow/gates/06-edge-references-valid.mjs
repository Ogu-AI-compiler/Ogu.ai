/**
 * Gate UXF006 — edge-references-valid
 * Every edge's from and to must reference existing node ids.
 * Dangling edges create undefined navigation behavior.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXF006', message: 'user-flow-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXF006', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.edges)) {
    return { pass: true, code: 'UXF006', message: 'Missing nodes or edges — skipped', skipped: true };
  }

  const nodeIds = new Set(spec.nodes.map(n => n.id).filter(id => typeof id === 'string'));
  const violations = [];

  spec.edges.forEach((edge, i) => {
    if (typeof edge.from !== 'string' || !nodeIds.has(edge.from)) {
      violations.push(`edges[${i}] from="${edge.from}" does not reference a valid node`);
    }
    if (typeof edge.to !== 'string' || !nodeIds.has(edge.to)) {
      violations.push(`edges[${i}] to="${edge.to}" does not reference a valid node`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF006',
      message: `${violations.length} edge(s) with invalid node references`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF006',
    message: `edge-references-valid: all ${spec.edges.length} edge(s) reference valid nodes`,
  };
}
