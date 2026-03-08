/**
 * Gate: namespace-matches-env (KO005)
 * When a namespaceOverride is declared, validates that it contains the
 * environment name as a substring. A production overlay deploying to a
 * staging namespace is a correctness risk — resources land in the wrong
 * environment with no runtime error at apply time.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'kustomize-spec.json'), 'utf8'));

  if (!spec.namespaceOverride) {
    return { pass: true, code: 'KO005', message: 'No namespaceOverride — skipped', skipped: true };
  }

  const env = (spec.environment ?? '').toLowerCase();
  const ns  = spec.namespaceOverride.toLowerCase();

  if (!ns.includes(env) && !spec.allowNamespaceMismatch) {
    return {
      pass: false, code: 'KO005',
      message: `Namespace override "${spec.namespaceOverride}" does not include environment name "${spec.environment}"`,
      detail: {
        namespaceOverride: spec.namespaceOverride,
        environment:       spec.environment,
        hint:              'Namespace should contain the environment name (e.g. "myapp-production") to prevent cross-environment deployments. Set allowNamespaceMismatch: true to override.',
      },
    };
  }

  return { pass: true, code: 'KO005', message: `Namespace "${spec.namespaceOverride}" matches environment "${spec.environment}"` };
}
