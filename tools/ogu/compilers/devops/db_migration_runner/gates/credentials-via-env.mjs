/**
 * Gate: credentials-via-env (MR004)
 * Validates that the migration spec does not contain literal database credential
 * values. Credentials committed in spec files are exposed in version control,
 * CI logs, and audit trails. All connection strings must reference environment
 * variable placeholders, not literal values.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Matches credential-looking fields that contain a literal value (not a $VAR placeholder)
const CRED_PATTERN = /(?:DATABASE_URL|DB_PASSWORD|POSTGRES_PASSWORD)\s*[:=]\s*["'][^$\${][^"']{4,}["']/i;

export async function run({ dir }) {
  const content = JSON.stringify(JSON.parse(readFileSync(join(dir, 'db-migration-runner-spec.json'), 'utf8')));

  if (CRED_PATTERN.test(content)) {
    return {
      pass: false, code: 'MR004',
      message: 'Literal database credential detected in migration spec',
      detail: {
        reason: 'DATABASE_URL, DB_PASSWORD, or POSTGRES_PASSWORD contains a literal value rather than an environment variable reference',
        hint:   'Use a placeholder like "$DATABASE_URL" or "${DATABASE_URL}" that will be resolved from environment at runtime',
      },
    };
  }

  return { pass: true, code: 'MR004', message: 'No literal credentials found' };
}
