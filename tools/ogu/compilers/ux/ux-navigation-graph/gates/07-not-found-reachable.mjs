/**
 * Gate UNG007 — not-found-reachable
 * The navigation graph must declare how users reach the 404/not-found state.
 * This can be:
 *   1. A node with type="not-found" (or id/route matching 404/not-found patterns)
 *   2. A global fallback declaration (spec.fallbackNode pointing to a valid node id)
 *   3. Escape hatch: spec.notFoundHandledExternally = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function isNotFoundNode(node) {
  if (node.type === 'not-found') return true;
  if (typeof node.route === 'string') {
    const r = node.route.toLowerCase();
    if (r === '/404' || r === '/not-found') return true;
  }
  if (typeof node.id === 'string') {
    const id = node.id.toLowerCase();
    if (id.includes('not-found') || id.includes('404') || id.includes('notfound')) return true;
  }
  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG007', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG007', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (spec.notFoundHandledExternally === true) {
    return {
      pass: true,
      code: 'UNG007',
      message: 'not-found-reachable: notFoundHandledExternally=true — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'UNG007', message: 'No nodes to check — skipped', skipped: true };
  }

  // Check for fallbackNode declaration
  if (typeof spec.fallbackNode === 'string') {
    const nodeIds = new Set(spec.nodes.map(n => n.id).filter(id => typeof id === 'string'));
    if (nodeIds.has(spec.fallbackNode)) {
      return {
        pass: true,
        code: 'UNG007',
        message: `not-found-reachable: fallbackNode="${spec.fallbackNode}" is declared and valid`,
      };
    }
    return {
      pass: false,
      code: 'UNG007',
      message: `fallbackNode="${spec.fallbackNode}" does not reference a valid node id`,
    };
  }

  const found = spec.nodes.some(isNotFoundNode);
  if (!found) {
    return {
      pass: false,
      code: 'UNG007',
      message: 'No 404/not-found node in navigation graph',
      detail: [
        'Add a node with type="not-found", route="/404", or id containing "404"/"not-found".',
        'Or declare spec.fallbackNode pointing to a valid node.',
        'Or set spec.notFoundHandledExternally: true.',
      ].join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG007',
    message: 'not-found-reachable: 404/not-found state is declared in navigation graph',
  };
}
