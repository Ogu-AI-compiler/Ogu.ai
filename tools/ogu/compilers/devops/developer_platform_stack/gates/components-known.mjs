/**
 * Gate: components-known (DP002)
 * Validates that every component type is in the allowlist of recognised
 * platform component categories. Unknown component types may be typos or
 * categories that need to be standardised before the platform spec is applied.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const KNOWN_COMPONENTS = new Set([
  'source-control', 'ci-cd', 'artifact-registry', 'secret-manager', 'idp', 'api-gateway',
  'service-mesh', 'observability', 'feature-flags', 'developer-portal', 'local-dev',
  'gitops', 'code-review', 'dependency-scanning', 'sbom', 'iac-automation',
  'platform-api', 'self-service-catalog', 'cost-attribution', 'oncall',
]);

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dev-platform-spec.json'), 'utf8'));
  const violations = spec.components
    .filter(c => !KNOWN_COMPONENTS.has(c.type?.toLowerCase()))
    .map(c => ({
      type:    c.type || '(no type)',
      reason:  `Component type "${c.type}" is not in the allowlist of recognised platform components`,
      allowed: [...KNOWN_COMPONENTS],
    }));

  if (violations.length) {
    return {
      pass: false, code: 'DP002',
      message: `${violations.length} unknown component type(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DP002', message: `All ${spec.components.length} component(s) recognized` };
}
