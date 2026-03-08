import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'invalidation-spec.json'), 'utf8'));
  const violations = [];

  // Every mutation in the system should appear in the map
  if (spec.allMutations) {
    const mapped = new Set(Object.keys(spec.map));
    const unmapped = spec.allMutations.filter(m => !mapped.has(m));
    if (unmapped.length) {
      violations.push(`Mutations not in invalidation map: ${unmapped.join(', ')} — every mutation must declare its invalidations`);
    }
  }

  // No mutation should map to zero queries (unless explicitly marked fire-and-forget)
  for (const [mutation, queries] of Object.entries(spec.map)) {
    if (queries.length === 0) {
      const isFireAndForget = spec.fireAndForget?.includes(mutation);
      if (!isFireAndForget) {
        violations.push(`'${mutation}' maps to 0 queries — add to spec.fireAndForget if intentional`);
      }
    }
  }

  if (violations.length) return { pass: false, code: 'IV007', message: `Contract violations (${violations.length})`, detail: violations.join('\n') };
  return { pass: true, code: 'IV007', message: 'Invalidation map contract passed' };
}
