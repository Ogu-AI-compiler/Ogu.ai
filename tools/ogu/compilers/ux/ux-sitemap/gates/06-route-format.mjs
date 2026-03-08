/**
 * Gate USM006 — route-format
 * Every node route must begin with "/" and use valid URL path characters.
 * Dynamic segments are allowed: /users/:id, /items/[slug].
 * Routes flagged as "planned" in the node are allowed to have placeholder routes.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Allows: /path, /path/:param, /path/[param], /path/*/rest, /
const VALID_ROUTE_RE = /^\/[a-zA-Z0-9\-._~:@!$&'()*+,;=%/[\]{}]*$/;

function isValidRoute(route) {
  if (typeof route !== 'string') return false;
  if (route === '/') return true;
  return VALID_ROUTE_RE.test(route);
}

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM006', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM006', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM006', message: 'No nodes to check — skipped', skipped: true };
  }

  const violations = [];

  for (const node of spec.nodes) {
    if (typeof node.route !== 'string') continue;
    // Nodes explicitly marked planned may use TBD placeholders
    if (node.planned === true) continue;
    if (!isValidRoute(node.route)) {
      violations.push(
        `Node "${node.id}" has invalid route: "${node.route}" ` +
        `(must start with / and use valid URL path characters)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USM006',
      message: `${violations.length} node(s) with invalid route format`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM006',
    message: 'route-format: all node routes are valid URL paths',
  };
}
