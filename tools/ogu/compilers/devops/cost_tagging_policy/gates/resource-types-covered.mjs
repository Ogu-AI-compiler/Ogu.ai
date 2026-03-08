/**
 * Gate: resource-types-covered (CT004)
 * When resourceTypes is declared, validates that at least the minimum resource
 * categories (compute, storage, network) are covered. A tagging policy that
 * omits entire resource categories creates blind spots in cost attribution.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIN_RESOURCE_TYPES = ['compute', 'storage', 'network'];

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'cost-tagging-spec.json'), 'utf8'));

  if (!spec.resourceTypes) {
    return { pass: true, code: 'CT004', message: 'No resourceTypes defined — policy applies to all resources (OK)', skipped: true };
  }

  const covered = (spec.resourceTypes || []).map(r => r.toLowerCase());
  const missing  = MIN_RESOURCE_TYPES.filter(rt => !covered.some(c => c.includes(rt)));

  if (missing.length && !spec.skipResourceTypeCoverage) {
    return {
      pass: false, code: 'CT004',
      message: `Missing coverage for minimum resource categories: ${missing.join(', ')}`,
      detail: {
        missing,
        covered,
        hint: 'Ensure compute, storage, and network resources are covered by the tagging policy. Set skipResourceTypeCoverage: true for exemption.',
      },
    };
  }

  return { pass: true, code: 'CT004', message: `Resource type coverage satisfied (${covered.length} type(s))` };
}
