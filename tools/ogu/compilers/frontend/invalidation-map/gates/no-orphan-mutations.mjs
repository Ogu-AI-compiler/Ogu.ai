import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'invalidation-spec.json'), 'utf8'));
  if (!spec.mutationArtifacts) return { pass: true, code: 'IV003', message: 'No mutationArtifacts map — skipping', skipped: true };

  const violations = [];
  const knownMutations = new Set();

  for (const [mutName, artifactRef] of Object.entries(spec.mutationArtifacts)) {
    const path = resolve(dir, artifactRef);
    if (!existsSync(path)) { violations.push(`mutation-artifact not found for '${mutName}': ${path}`); continue; }
    knownMutations.add(mutName);
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    if (artifact.hook_name) knownMutations.add(artifact.hook_name);
  }

  for (const mutationKey of Object.keys(spec.map)) {
    if (!knownMutations.has(mutationKey)) {
      violations.push(`Mutation '${mutationKey}' in map has no corresponding mutation-artifact`);
    }
  }

  if (violations.length) return { pass: false, code: 'IV003', message: `Orphan mutation references (${violations.length})`, detail: violations.join('\n') };
  return { pass: true, code: 'IV003', message: 'All mutations have corresponding artifacts' };
}
