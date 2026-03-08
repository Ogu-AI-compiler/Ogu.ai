import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * USA006 — skeleton-geometry: if skeleton state declared, it must reference
 * the same layout dimensions as the loaded state.
 *
 * Skeleton screens that don't match the final component geometry cause jarring
 * layout shifts when content loads.
 *
 * The spec must declare: skeleton.matchesGeometry: true
 * OR provide explicit width/height that match the default state dimensions.
 */
export async function run({ dir }) {
  const specPath = join(dir, 'state-appearance-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USA006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USA006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const components = Array.isArray(spec.components) ? spec.components : [];

  // Find components that declare a skeleton state
  const componentsWithSkeleton = components.filter(comp =>
    comp.states && comp.states.skeleton
  );

  if (componentsWithSkeleton.length === 0) {
    return { pass: true, code: 'USA006', message: 'No skeleton states declared — gate skipped', skipped: true };
  }

  const violations = [];

  for (const comp of componentsWithSkeleton) {
    const compId = comp.id || '(unnamed)';
    const skeletonState = comp.states.skeleton;

    if (typeof skeletonState !== 'object') continue;

    // Check 1: explicit matchesGeometry flag
    if (skeletonState.matchesGeometry === true) continue;

    // Check 2: skeleton declares same width/height as default state
    const defaultState = comp.states.default || {};
    const skeletonHasWidth  = skeletonState.width !== undefined;
    const skeletonHasHeight = skeletonState.height !== undefined;
    const defaultHasWidth   = defaultState.width !== undefined;
    const defaultHasHeight  = defaultState.height !== undefined;

    if (skeletonHasWidth && defaultHasWidth && skeletonState.width !== defaultState.width) {
      violations.push(`"${compId}": skeleton.width "${skeletonState.width}" ≠ default.width "${defaultState.width}" — causes layout shift`);
    }

    if (skeletonHasHeight && defaultHasHeight && skeletonState.height !== defaultState.height) {
      violations.push(`"${compId}": skeleton.height "${skeletonState.height}" ≠ default.height "${defaultState.height}" — causes layout shift`);
    }

    // If skeleton has neither matchesGeometry nor explicit dimensions that match, flag it
    if (!skeletonHasWidth && !skeletonHasHeight && skeletonState.matchesGeometry !== true) {
      violations.push(
        `"${compId}": skeleton state declared but has no geometry match — add matchesGeometry: true or explicit width/height matching default state`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USA006',
      message: `${violations.length} skeleton state(s) have geometry mismatches`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USA006', message: `All ${componentsWithSkeleton.length} skeleton state(s) match component geometry` };
}
