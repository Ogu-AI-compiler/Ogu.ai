import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';

export async function run({ dir, projectRoot }) {
  const spec = JSON.parse(readFileSync(join(dir, 'mutation-spec.json'), 'utf8'));

  if (!spec.invalidatesQueries || !spec.invalidatesQueries.length) {
    return { pass: true, code: 'MU012', message: 'No invalidatesQueries in spec — skipping cross-query check', skipped: true };
  }

  const hookFiles = readdirSync(dir).filter(f => f.startsWith('use') && (f.endsWith('.ts') || f.endsWith('.tsx')));
  if (!hookFiles.length) {
    return { pass: false, code: 'MU012', message: 'No hook file found' };
  }

  const hookContent = readFileSync(join(dir, hookFiles[0]), 'utf8');
  const violations = [];

  // For each declared invalidation target, find the query-artifact
  for (const queryRef of spec.invalidatesQueries) {
    const artifactPath = resolve(dir, queryRef);

    if (!existsSync(artifactPath)) {
      // Try to find query-artifact.json in sibling dirs
      const root = projectRoot || dir;
      const found = readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => join(root, d.name, 'query-artifact.json'))
        .find(p => existsSync(p));

      if (!found) {
        violations.push(`query-artifact not found: ${artifactPath} — compile the query-module first`);
        continue;
      }
    }

    const queryArtifact = existsSync(artifactPath)
      ? JSON.parse(readFileSync(artifactPath, 'utf8'))
      : null;

    if (!queryArtifact) continue;

    // Check that the hook file references the queryKey from this artifact
    const hookName = queryArtifact.hook_name;
    const keyPattern = new RegExp(`${hookName.replace('use', '').replace('Query', '')}.*[Kk]ey`, 'i');

    if (!keyPattern.test(hookContent) && !hookContent.includes(hookName)) {
      violations.push(`Mutation invalidates ${hookName}'s cache but doesn't import its queryKey — import the queryKey constant instead of hardcoding strings`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'MU012', message: 'Cross-query invalidation mismatch', detail: violations.join('\n') };
  }

  return { pass: true, code: 'MU012', message: `Cross-query valid — invalidation keys match ${spec.invalidatesQueries.length} query artifact(s)` };
}
