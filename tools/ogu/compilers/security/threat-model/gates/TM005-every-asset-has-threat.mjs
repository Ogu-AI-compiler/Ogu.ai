import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM005 — every-asset-has-threat: each declared asset must be referenced by at least one threat */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TM005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.assets) || spec.assets.length === 0) {
    return { pass: true, code: 'TM005', message: 'No assets declared — gate skipped', skipped: true };
  }
  if (!Array.isArray(spec.threats) || spec.threats.length === 0) {
    return {
      pass: false,
      code: 'TM005',
      message: `${spec.assets.length} asset(s) declared but no threats — every asset must have at least one threat`,
      detail: spec.assets.map(a => `Asset "${a.id || a.name || '?'}" has no associated threat`).join('\n'),
    };
  }

  // Build a set of all component names referenced across all threats
  const referencedComponents = new Set();
  for (const threat of spec.threats) {
    if (typeof threat.affected_component === 'string') {
      referencedComponents.add(threat.affected_component.toLowerCase());
    }
    if (Array.isArray(threat.affected_components)) {
      for (const comp of threat.affected_components) {
        referencedComponents.add(String(comp).toLowerCase());
      }
    }
  }

  const violations = [];

  for (const asset of spec.assets) {
    const assetId = String(asset.id || asset.name || '?').toLowerCase();
    if (!referencedComponents.has(assetId)) {
      violations.push(`Asset "${asset.id || asset.name || '?'}": not referenced as affected_component in any threat — every asset must have at least one associated threat`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM005',
      message: `${violations.length} asset(s) have no associated threat`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'TM005', message: `All ${spec.assets.length} asset(s) are referenced in at least one threat` };
}
