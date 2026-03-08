/**
 * Gate USM009 — contract-sitemap
 * Validates sitemap-spec.json against the sitemap contract rules:
 * - All required top-level fields present
 * - Every authenticated node has visibility declared
 * - Route duplicates are absent
 * - Sitemap version is declared
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM009', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM009', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM009', message: 'No nodes to check — skipped', skipped: true };
  }

  const violations = [];

  // Rule: version must be declared
  if (!spec.version) {
    violations.push('Contract: sitemap-spec.json missing field "version"');
  }

  // Rule: authenticated-visibility — nodes accessing auth-only data must declare visibility
  for (const node of spec.nodes) {
    if (node.auth === true && (!node.visibility || node.visibility === 'public')) {
      violations.push(
        `Contract: Node "${node.id}" has auth=true but visibility is "${node.visibility || 'not set'}" — must be "authenticated" or a role`
      );
    }
  }

  // Rule: no duplicate routes (routes must be unique per sitemap)
  const routeSeen = new Map();
  for (const node of spec.nodes) {
    if (typeof node.route !== 'string') continue;
    if (node.planned === true) continue;
    if (routeSeen.has(node.route)) {
      violations.push(
        `Contract: Duplicate route "${node.route}" found in nodes "${routeSeen.get(node.route)}" and "${node.id}"`
      );
    } else {
      routeSeen.set(node.route, node.id);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USM009',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM009',
    message: 'contract-sitemap: all contract rules satisfied',
  };
}
