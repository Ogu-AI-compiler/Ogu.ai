import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'invalidation-spec.json'), 'utf8'));
  if (!spec.queryArtifacts) return { pass: true, code: 'IV005', message: 'No queryArtifacts — skipping', skipped: true };

  const violations = [];
  for (const [name, ref] of Object.entries(spec.queryArtifacts)) {
    const path = resolve(dir, ref);
    if (!existsSync(path)) { violations.push(`query-artifact missing: ${path}`); continue; }
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    if (artifact.compiler !== 'query-module') {
      violations.push(`'${name}' artifact was not compiled by query-module (got: ${artifact.compiler})`);
    }
  }

  if (violations.length) return { pass: false, code: 'IV005', message: 'Query artifact mismatches', detail: violations.join('\n') };
  return { pass: true, code: 'IV005', message: 'All query artifacts valid' };
}
