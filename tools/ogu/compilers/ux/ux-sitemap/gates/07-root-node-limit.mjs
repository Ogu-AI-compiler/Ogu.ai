/**
 * Gate USM007 — root-node-limit
 * Root-level nodes (parent === null or parent absent) must not exceed the configured
 * maximum (default 10). More than 10 top-level nav items indicates an IA problem.
 * Override with sitemap-spec.json field: maxRootNodes (integer).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DEFAULT_MAX_ROOT_NODES = 10;

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM007', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM007', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM007', message: 'No nodes to check — skipped', skipped: true };
  }

  const maxRootNodes = typeof spec.maxRootNodes === 'number'
    ? spec.maxRootNodes
    : DEFAULT_MAX_ROOT_NODES;

  const rootNodes = spec.nodes.filter(n => n.parent === null || n.parent === undefined);

  if (rootNodes.length > maxRootNodes) {
    const rootIds = rootNodes.map(n => `"${n.id}"`).join(', ');
    return {
      pass: false,
      code: 'USM007',
      message: `${rootNodes.length} root-level nodes exceed limit of ${maxRootNodes}`,
      detail: `Root nodes: ${rootIds}\nTip: Group related sections under a parent node, or set maxRootNodes in sitemap-spec.json.`,
    };
  }

  return {
    pass: true,
    code: 'USM007',
    message: `root-node-limit: ${rootNodes.length} root node(s) (limit: ${maxRootNodes})`,
  };
}
