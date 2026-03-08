import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'invalidation-spec.json'), 'utf8'));
  if (!spec.queryArtifacts) return { pass: true, code: 'IV002', message: 'No queryArtifacts map — skipping', skipped: true };

  const violations = [];
  const allQueryKeys = new Set();

  for (const [queryName, artifactRef] of Object.entries(spec.queryArtifacts)) {
    const path = resolve(dir, artifactRef);
    if (!existsSync(path)) {
      violations.push(`query-artifact not found for '${queryName}': ${path}`);
      continue;
    }
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    allQueryKeys.add(queryName);
    if (artifact.hook_name) allQueryKeys.add(artifact.hook_name);
  }

  // Check every query key in the map exists in queryArtifacts
  for (const queries of Object.values(spec.map)) {
    for (const q of queries) {
      if (!allQueryKeys.has(q)) {
        violations.push(`Query key '${q}' in map has no matching query-artifact`);
      }
    }
  }

  if (violations.length) return { pass: false, code: 'IV002', message: `Orphan query references (${violations.length})`, detail: violations.join('\n') };
  return { pass: true, code: 'IV002', message: 'All query keys have corresponding artifacts' };
}
