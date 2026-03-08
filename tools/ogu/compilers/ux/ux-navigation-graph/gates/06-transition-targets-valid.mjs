/**
 * Gate UNG006 — transition-targets-valid
 * Every transition.to value must reference a node id that exists in the graph.
 * Dangling transitions point to screens that don't exist in the navigation spec.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG006', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG006', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'UNG006', message: 'No nodes to check — skipped', skipped: true };
  }

  const nodeIds = new Set(spec.nodes.map(n => n.id).filter(id => typeof id === 'string'));
  const violations = [];

  for (const node of spec.nodes) {
    if (!Array.isArray(node.transitions)) continue;
    node.transitions.forEach((t, i) => {
      if (typeof t.to !== 'string') {
        violations.push(`Node "${node.id}" transition[${i}] missing field: to`);
        return;
      }
      if (!nodeIds.has(t.to)) {
        violations.push(
          `Node "${node.id}" transition[${i}] targets "${t.to}" which does not exist in the graph`
        );
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UNG006',
      message: `${violations.length} invalid transition target(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG006',
    message: 'transition-targets-valid: all transition targets are valid node ids',
  };
}
