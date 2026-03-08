/**
 * Gate UNG004 — guards-declared
 * Every node with auth=true or visibility!="public" must declare a guard.
 * A guard is declared by: node.guard (object or string), or node.redirectOnFail (string).
 * This ensures that every protected route in the navigation graph has
 * a machine-checkable access control declaration.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function hasGuard(node) {
  if (node.guard !== undefined && node.guard !== null) return true;
  if (typeof node.redirectOnFail === 'string' && node.redirectOnFail.trim() !== '') return true;
  return false;
}

function isProtected(node) {
  if (node.auth === true) return true;
  if (typeof node.visibility === 'string' && node.visibility !== 'public') return true;
  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG004', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG004', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'UNG004', message: 'No nodes to check — skipped', skipped: true };
  }

  const violations = [];

  for (const node of spec.nodes) {
    if (!isProtected(node)) continue;
    if (!hasGuard(node)) {
      violations.push(
        `Node "${node.id}" is protected (auth=${node.auth}, visibility="${node.visibility}") ` +
        `but declares no guard or redirectOnFail`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UNG004',
      message: `${violations.length} protected node(s) missing guard declaration`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG004',
    message: 'guards-declared: all protected nodes have guard declarations',
  };
}
