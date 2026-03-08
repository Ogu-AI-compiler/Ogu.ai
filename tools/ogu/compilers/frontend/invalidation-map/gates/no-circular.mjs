import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'invalidation-spec.json'), 'utf8'));

  // Build: mutation → queries it invalidates
  // If spec also has queryTriggersMutation (query refetch that auto-fires mutation), check for cycles
  if (!spec.queryTriggersMutation) {
    return { pass: true, code: 'IV004', message: 'No queryTriggersMutation defined — circular check not applicable', skipped: true };
  }

  // mutation → [queries]; query → [mutations]
  const mutInvalidates = spec.map; // { mutationA: [queryX, queryY] }
  const queryTriggers = spec.queryTriggersMutation; // { queryX: [mutationA] }

  const cycles = [];
  for (const [mutation, queries] of Object.entries(mutInvalidates)) {
    for (const query of queries) {
      const triggeredMutations = queryTriggers[query] || [];
      if (triggeredMutations.includes(mutation)) {
        cycles.push(`Circular: ${mutation} → invalidates ${query} → triggers ${mutation}`);
      }
    }
  }

  if (cycles.length) return { pass: false, code: 'IV004', message: `Circular invalidations (${cycles.length})`, detail: cycles.join('\n') };
  return { pass: true, code: 'IV004', message: 'No circular invalidations' };
}
