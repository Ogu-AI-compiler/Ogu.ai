/**
 * Gate UXF001 — spec-valid
 * user-flow-spec.json must exist with:
 * - nodes (array) — each node has id and type
 * - edges (array) — each edge has from, to, and trigger
 * - terminals (array of node ids) — classified terminal nodes
 * - entryNodes (array of node ids) — valid flow entry points
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'user-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'UXF001',
      message: 'user-flow-spec.json not found',
      detail: `Expected: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UXF001',
      message: `user-flow-spec.json parse error: ${err.message}`,
    };
  }

  const missing = [];
  if (!Array.isArray(spec.nodes))      missing.push('nodes (array)');
  if (!Array.isArray(spec.edges))      missing.push('edges (array)');
  if (!Array.isArray(spec.terminals))  missing.push('terminals (array)');
  if (!Array.isArray(spec.entryNodes)) missing.push('entryNodes (array)');

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UXF001',
      message: `user-flow-spec.json missing required fields: ${missing.join(', ')}`,
    };
  }

  if (spec.nodes.length === 0) {
    return { pass: false, code: 'UXF001', message: 'nodes array is empty' };
  }
  if (spec.entryNodes.length === 0) {
    return { pass: false, code: 'UXF001', message: 'entryNodes array is empty — at least one entry required' };
  }
  if (spec.terminals.length === 0) {
    return { pass: false, code: 'UXF001', message: 'terminals array is empty — at least one terminal required' };
  }

  const violations = [];
  spec.nodes.forEach((node, i) => {
    if (typeof node.id !== 'string' || node.id.trim() === '') {
      violations.push(`nodes[${i}] missing or invalid field: id`);
    }
    if (!node.type) {
      violations.push(`nodes[${i}] (id="${node.id}") missing field: type (screen|decision|terminal|system)`);
    }
  });

  spec.edges.forEach((edge, i) => {
    if (typeof edge.from !== 'string') violations.push(`edges[${i}] missing field: from`);
    if (typeof edge.to !== 'string')   violations.push(`edges[${i}] missing field: to`);
    if (!edge.trigger)                 violations.push(`edges[${i}] missing field: trigger`);
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXF001',
      message: `${violations.length} structural violation(s) in user-flow-spec.json`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXF001',
    message: `spec-valid: ${spec.nodes.length} node(s), ${spec.edges.length} edge(s), ${spec.terminals.length} terminal(s)`,
  };
}
