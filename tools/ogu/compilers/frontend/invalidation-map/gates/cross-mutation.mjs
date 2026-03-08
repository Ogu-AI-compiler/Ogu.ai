import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'invalidation-spec.json'), 'utf8'));
  if (!spec.mutationArtifacts) return { pass: true, code: 'IV006', message: 'No mutationArtifacts — skipping', skipped: true };

  const violations = [];
  for (const [name, ref] of Object.entries(spec.mutationArtifacts)) {
    const path = resolve(dir, ref);
    if (!existsSync(path)) { violations.push(`mutation-artifact missing: ${path}`); continue; }
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    if (artifact.compiler !== 'mutation-module') {
      violations.push(`'${name}' artifact was not compiled by mutation-module (got: ${artifact.compiler})`);
    }
    // Cross-check: mutation's own declared invalidations should be subset of this map
    const mutInvalidates = spec.map[name] || [];
    const artifactInvalidates = artifact.invalidates_queries || [];
    const undeclared = artifactInvalidates.filter(q => !mutInvalidates.includes(q));
    if (undeclared.length) {
      violations.push(`'${name}': mutation-artifact declares invalidation of [${undeclared.join(', ')}] but these are not in the invalidation-map`);
    }
  }

  if (violations.length) return { pass: false, code: 'IV006', message: 'Mutation artifact mismatches', detail: violations.join('\n') };
  return { pass: true, code: 'IV006', message: 'All mutation artifacts valid and invalidation map is complete' };
}
