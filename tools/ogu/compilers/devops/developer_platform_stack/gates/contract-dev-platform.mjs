/**
 * Gate: contract-dev-platform (DP007)
 * Validates that the developer platform stack satisfies the contract: the three
 * foundational component types (source-control, ci-cd, artifact-registry) must be
 * present, and no component type may appear more than once unless marked multi: true.
 * A platform missing any pillar is incomplete — developers cannot build without CI/CD,
 * cannot store artefacts without a registry, and cannot collaborate without source control.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const REQUIRED_TYPES = ['source-control', 'ci-cd', 'artifact-registry'];

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dev-platform-spec.json'), 'utf8'));
  const violations = [];
  const types      = spec.components.map(c => c.type?.toLowerCase());

  // All three foundational component types must be present
  for (const rt of REQUIRED_TYPES) {
    const skipKey = `skip${rt.replace(/-/g, '_').replace(/\b./g, c => c.toUpperCase())}Check`;
    if (!types.includes(rt) && !spec[skipKey]) {
      violations.push({
        rule:   'required-component-type',
        type:   rt,
        reason: `Missing required component type: "${rt}" — a developer platform without ${rt} is incomplete`,
        hint:   `Add a component with type: "${rt}", or set ${skipKey}: true with justification`,
      });
    }
  }

  // No duplicate component types unless explicitly marked multi: true
  const seen = new Map();
  for (const c of spec.components) {
    const k = c.type?.toLowerCase();
    if (!c.multi && seen.has(k)) {
      violations.push({
        rule:   'no-duplicate-component-type',
        type:   k,
        reason: `Duplicate component type "${k}" — having two of the same type causes ambiguity about which instance is authoritative`,
        hint:   'Set multi: true on each component if multiple instances are intentional',
      });
    }
    seen.set(k, true);
  }

  if (violations.length) {
    return {
      pass: false, code: 'DP007',
      message: `${violations.length} contract violation(s) in dev-platform-spec.json`,
      detail: { violations },
    };
  }

  return {
    pass: true, code: 'DP007',
    message: `Developer platform stack contract satisfied — ${spec.components.length} component(s)`,
  };
}
