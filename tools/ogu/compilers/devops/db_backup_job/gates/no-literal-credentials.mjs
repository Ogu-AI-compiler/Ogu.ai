/**
 * Gate: no-literal-credentials (DBB005)
 * Validates that the backup spec does not contain literal credential values.
 * Credentials committed in spec files are exposed in version control, CI logs,
 * and audit trails. All secrets must reference environment variable placeholders.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Matches credential-looking fields that contain a literal value (not a $VAR placeholder)
const CRED_PATTERN = /(?:password|secret_key|api_key)\s*[:=]\s*["'][^$"']{6,}["']/i;

export async function run({ dir }) {
  const content = JSON.stringify(JSON.parse(readFileSync(join(dir, 'db-backup-spec.json'), 'utf8')));

  if (CRED_PATTERN.test(content)) {
    return {
      pass: false, code: 'DBB005',
      message: 'Literal credential found in db-backup-spec.json',
      detail: {
        reason: 'password, secret_key, or api_key contains a literal value rather than an environment variable reference',
        hint:   'Use a placeholder like "$SECRET_KEY" or "${API_KEY}" that will be resolved from environment at runtime',
      },
    };
  }

  return { pass: true, code: 'DBB005', message: 'No literal credentials found' };
}
