/**
 * Gate UNG009 — contract-navigation
 * Final contract check for the navigation spec:
 * - version field declared
 * - All transition triggers are typed (not anonymous/undefined)
 * - No node has both auth=true and no visibility declared
 * - Unique node ids across the graph
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG009', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG009', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'UNG009', message: 'No nodes to check — skipped', skipped: true };
  }

  const violations = [];

  // Rule: version declared
  if (!spec.version) {
    violations.push('Contract: navigation-spec.json missing field "version"');
  }

  // Rule: unique node ids
  const seenIds = new Map();
  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (seenIds.has(node.id)) {
      violations.push(`Contract: Duplicate node id "${node.id}"`);
    } else {
      seenIds.set(node.id, true);
    }
  }

  // Rule: all transitions have a trigger type
  for (const node of spec.nodes) {
    if (!Array.isArray(node.transitions)) continue;
    node.transitions.forEach((t, i) => {
      if (!t.trigger || (typeof t.trigger === 'string' && t.trigger.trim() === '')) {
        violations.push(
          `Contract: Node "${node.id}" transition[${i}] to "${t.to}" has no trigger type defined ` +
          `(e.g., "click", "submit", "system", "deepLink")`
        );
      }
    });
  }

  // Rule: auth=true nodes must declare visibility
  for (const node of spec.nodes) {
    if (node.auth === true && !node.visibility) {
      violations.push(
        `Contract: Node "${node.id}" has auth=true but no visibility declared`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UNG009',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG009',
    message: 'contract-navigation: all contract rules satisfied',
  };
}
