/**
 * Gate: db-refs-declared (DS005)
 * Validates that every DB reference declared in the spec is mapped to either
 * an environment variable key or a Kubernetes Secret reference. Unmapped DB
 * refs mean the connection string will not be injected — the seed job will
 * fail to connect to the database at startup.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'data-seed-spec.json'), 'utf8'));
  const violations = (spec.dbRefs || [])
    .filter(r => !r.envKey && !r.secretName)
    .map(r => ({
      dbRef:  r.name || r.db || '(unnamed)',
      reason: 'DB ref is not mapped to an envKey or secretName — connection string will not be injected at runtime',
      hint:   'Add envKey: "DATABASE_URL" or secretName: "db-credentials" to this DB ref',
    }));

  if (violations.length) {
    return {
      pass: false, code: 'DS005',
      message: `${violations.length} DB ref(s) not mapped to env or secret`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DS005', message: 'All DB refs declared' };
}
