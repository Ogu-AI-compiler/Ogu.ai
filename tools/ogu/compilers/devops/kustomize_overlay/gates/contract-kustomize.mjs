/**
 * Gate: contract-kustomize (KO007)
 * Validates that kustomize-spec.json satisfies the Kustomize contract:
 * every overlay must declare an imageTagPolicy so that image pinning strategy
 * is explicit (digest, semver, or latest-allowed).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_POLICIES = ['digest', 'semver', 'latest-allowed'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'kustomize-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.imageTagPolicy) {
    violations.push({
      rule:   'imageTagPolicy-required',
      reason: 'No imageTagPolicy declared — image tag override strategy is not explicit',
      hint:   `Set imageTagPolicy to one of: ${ALLOWED_POLICIES.join(', ')}`,
    });
  } else if (!ALLOWED_POLICIES.includes(spec.imageTagPolicy)) {
    violations.push({
      rule:     'imageTagPolicy-allowed',
      received: spec.imageTagPolicy,
      allowed:  ALLOWED_POLICIES,
      reason:   `imageTagPolicy "${spec.imageTagPolicy}" is not a recognised policy`,
      hint:     `Use one of: ${ALLOWED_POLICIES.join(', ')}`,
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'KO007',
      message: `${violations.length} contract violation(s) in kustomize-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'KO007', message: 'Kustomize contract satisfied' };
}
