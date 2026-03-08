/**
 * Gate: migration-dir-exists (MR002)
 * Validates that the migration directory exists and contains at least one
 * migration file. An empty or missing migration directory means the runner
 * has nothing to apply — this is almost always a configuration error or a
 * forgotten file commit.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATION_EXTENSIONS = ['.sql', '.ts', '.js'];

export async function run({ dir }) {
  const spec    = JSON.parse(readFileSync(join(dir, 'db-migration-runner-spec.json'), 'utf8'));
  const migDir  = join(dir, spec.migrationDir || 'migrations');

  if (!existsSync(migDir)) {
    return {
      pass: false, code: 'MR002',
      message: `Migration directory not found: ${spec.migrationDir || 'migrations'}`,
      detail: {
        searched: migDir,
        hint:     'Create the migration directory and add at least one migration file (.sql, .ts, or .js)',
      },
    };
  }

  const files = readdirSync(migDir).filter(f => MIGRATION_EXTENSIONS.some(ext => f.endsWith(ext)));

  if (files.length === 0) {
    return {
      pass: false, code: 'MR002',
      message: `Migration directory "${spec.migrationDir}" contains no migration files`,
      detail: {
        directory:          migDir,
        acceptedExtensions: MIGRATION_EXTENSIONS,
        hint:               'Add at least one migration file to the directory',
      },
    };
  }

  return { pass: true, code: 'MR002', message: `Migration directory valid — ${files.length} file(s)` };
}
