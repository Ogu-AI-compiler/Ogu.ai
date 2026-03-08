/**
 * Gate USM008 — not-found-declared
 * The sitemap must include a 404 / not-found screen node.
 * This is identified by route === "/404", route === "/not-found",
 * or node.type === "not-found" or node.id containing "not-found" / "404".
 * Escape hatch: set sitemap-spec.json field notFoundHandledExternally: true
 * (e.g. handled by hosting provider).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function isNotFoundNode(node) {
  if (typeof node.route === 'string') {
    const r = node.route.toLowerCase();
    if (r === '/404' || r === '/not-found' || r.endsWith('/404') || r.endsWith('/not-found')) {
      return true;
    }
  }
  if (node.type === 'not-found') return true;
  if (typeof node.id === 'string') {
    const id = node.id.toLowerCase();
    if (id.includes('not-found') || id.includes('404') || id.includes('notfound')) {
      return true;
    }
  }
  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM008', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM008', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (spec.notFoundHandledExternally === true) {
    return {
      pass: true,
      code: 'USM008',
      message: 'not-found-declared: notFoundHandledExternally=true — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM008', message: 'No nodes to check — skipped', skipped: true };
  }

  const found = spec.nodes.some(isNotFoundNode);

  if (!found) {
    return {
      pass: false,
      code: 'USM008',
      message: 'No 404/not-found screen declared in sitemap',
      detail: [
        'Add a node with route="/404", route="/not-found", type="not-found",',
        'or an id containing "404" or "not-found".',
        'Or set notFoundHandledExternally: true in sitemap-spec.json.',
      ].join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM008',
    message: 'not-found-declared: 404/not-found screen is present in sitemap',
  };
}
