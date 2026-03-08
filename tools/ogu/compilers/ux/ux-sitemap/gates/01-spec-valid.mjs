/**
 * Gate USM001 — spec-valid
 * sitemap-spec.json must exist and contain a valid nodes array.
 * Each node must have: id (string), label (string), route (string).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'USM001',
      message: 'sitemap-spec.json not found',
      detail: `Expected: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'USM001',
      message: `sitemap-spec.json parse error: ${err.message}`,
    };
  }

  if (!Array.isArray(spec.nodes)) {
    return {
      pass: false,
      code: 'USM001',
      message: 'sitemap-spec.json missing required field: nodes (must be an array)',
    };
  }

  if (spec.nodes.length === 0) {
    return {
      pass: false,
      code: 'USM001',
      message: 'sitemap-spec.json nodes array is empty — at least one node required',
    };
  }

  const violations = [];
  spec.nodes.forEach((node, i) => {
    if (typeof node.id !== 'string' || node.id.trim() === '') {
      violations.push(`nodes[${i}] missing or invalid field: id`);
    }
    if (typeof node.label !== 'string' || node.label.trim() === '') {
      violations.push(`nodes[${i}] (id="${node.id}") missing or invalid field: label`);
    }
    if (typeof node.route !== 'string' || node.route.trim() === '') {
      violations.push(`nodes[${i}] (id="${node.id}") missing or invalid field: route`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USM001',
      message: `sitemap-spec.json has ${violations.length} node(s) with missing required fields`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM001',
    message: `spec-valid: ${spec.nodes.length} node(s) parsed successfully`,
  };
}
