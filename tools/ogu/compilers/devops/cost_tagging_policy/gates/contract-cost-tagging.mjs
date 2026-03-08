/**
 * Gate: contract-cost-tagging (CT007)
 * Validates that the cost tagging policy satisfies the contract: no duplicate
 * tag keys, and enforce mode must declare enforcement targets so that the
 * policy is applied to specific resource types rather than everything globally.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'cost-tagging-spec.json'), 'utf8'));
  const violations = [];

  // No duplicate tag keys
  const keys  = spec.requiredTags.map(t => t.key);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) {
    violations.push({
      rule:   'no-duplicate-keys',
      dupes:  [...new Set(dupes)],
      reason: `Duplicate tag keys found: ${[...new Set(dupes)].join(', ')} — each key must be unique in the policy`,
    });
  }

  // Enforce mode requires at least one enforcement target
  if (spec.enforcementMode === 'enforce' && !spec.enforcementTargets?.length) {
    violations.push({
      rule:   'enforce-requires-targets',
      reason: 'enforcementMode=enforce requires enforcementTargets to be defined — enforcement without targets blocks all resource creation',
      hint:   'Add enforcementTargets listing the specific resource types or cloud services to enforce tagging on',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT007',
      message: `${violations.length} contract violation(s) in cost-tagging-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'CT007', message: 'Cost tagging policy contract satisfied' };
}
