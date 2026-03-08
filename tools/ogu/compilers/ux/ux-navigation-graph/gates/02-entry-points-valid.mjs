/**
 * Gate UNG002 — entry-points-valid
 * Every id in entryPoints must reference a node that exists in the nodes array.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'navigation-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UNG002', message: 'navigation-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UNG002', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || !Array.isArray(spec.entryPoints)) {
    return { pass: true, code: 'UNG002', message: 'Missing nodes or entryPoints — skipped', skipped: true };
  }

  const nodeIds = new Set(spec.nodes.map(n => n.id).filter(id => typeof id === 'string'));
  const violations = [];

  for (const ep of spec.entryPoints) {
    if (typeof ep !== 'string' || !nodeIds.has(ep)) {
      violations.push(`Entry point "${ep}" does not reference a valid node id`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UNG002',
      message: `${violations.length} invalid entry point(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UNG002',
    message: `entry-points-valid: all ${spec.entryPoints.length} entry point(s) reference valid nodes`,
  };
}
