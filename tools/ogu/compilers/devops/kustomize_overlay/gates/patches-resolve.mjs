/**
 * Gate: patches-resolve (KO003)
 * Validates that every patch declared in the spec includes a target.kind.
 * Patches without a target kind cannot be applied — kustomize will fail to
 * match the patch against any resource and the build will error at apply time.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec    = JSON.parse(readFileSync(join(dir, 'kustomize-spec.json'), 'utf8'));
  const patches = spec.patches || [];

  const violations = patches
    .filter(p => p.target && !p.target.kind)
    .map(p => ({
      patch:  JSON.stringify(p.target),
      reason: 'Patch target is missing required "kind" field — kustomize cannot match this patch to a resource',
      hint:   'Add target.kind (e.g., "Deployment", "Service") to identify the resource type to patch',
    }));

  if (violations.length) {
    return {
      pass: false, code: 'KO003',
      message: `${violations.length} patch(es) missing target.kind`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'KO003', message: `All ${patches.length} patches have valid targets` };
}
