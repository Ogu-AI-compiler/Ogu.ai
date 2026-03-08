/**
 * Gate USM003 — orphan-nodes
 * Every node with a non-null parent must reference a parent id that exists in the node list.
 * Root nodes (parent === null or parent is absent) are allowed.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM003', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM003', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM003', message: 'No nodes to check — skipped', skipped: true };
  }

  const nodeIds = new Set(spec.nodes.map(n => n.id).filter(id => typeof id === 'string'));
  const violations = [];

  for (const node of spec.nodes) {
    if (node.parent !== null && node.parent !== undefined) {
      if (typeof node.parent !== 'string' || !nodeIds.has(node.parent)) {
        violations.push(
          `Node "${node.id}" references parent "${node.parent}" which does not exist in the sitemap`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USM003',
      message: `${violations.length} orphan node(s) with invalid parent reference`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM003',
    message: 'orphan-nodes: all parent references are valid',
  };
}
