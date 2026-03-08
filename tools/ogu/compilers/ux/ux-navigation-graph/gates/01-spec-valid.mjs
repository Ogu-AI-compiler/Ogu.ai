/**
 * Gate UNG001 — spec-valid
 * navigation-spec.json must exist with required fields:
 * - nodes (array of nav nodes, each with id and transitions)
 * - entryPoints (array of node ids that are valid starting points)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'UNG001',
      message: 'navigation-spec.json not found',
      detail: `Expected: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UNG001',
      message: `navigation-spec.json parse error: ${err.message}`,
    };
  }

  const missing = [];
  if (!Array.isArray(spec.nodes)) missing.push('nodes (array)');
  if (!Array.isArray(spec.entryPoints)) missing.push('entryPoints (array)');

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UNG001',
      message: `navigation-spec.json missing required fields: ${missing.join(', ')}`,
    };
  }

  if (spec.nodes.length === 0) {
    return {
      pass: false,
      code: 'UNG001',
      message: 'navigation-spec.json nodes array is empty',
    };
  }

  if (spec.entryPoints.length === 0) {
    return {
      pass: false,
      code: 'UNG001',
      message: 'navigation-spec.json entryPoints array is empty — at least one entry point required',
    };
  }

  // Validate each node has required fields
  const violations = [];
  spec.nodes.forEach((node, i) => {
    if (typeof node.id !== 'string' || node.id.trim() === '') {
      violations.push(`nodes[${i}] missing or invalid field: id`);
    }
    if (!Array.isArray(node.transitions)) {
      violations.push(`nodes[${i}] (id="${node.id}") missing field: transitions (must be array)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UNG001',
      message: `${violations.length} node(s) with missing required fields`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG001',
    message: `spec-valid: ${spec.nodes.length} node(s), ${spec.entryPoints.length} entry point(s)`,
  };
}
