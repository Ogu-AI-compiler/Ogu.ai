/**
 * Gate: contract-migration-runner (MR007)
 * Validates that db-migration-runner-spec.json satisfies the migration runner
 * contract: every runner must declare a rollback command (to undo a failed
 * migration) and a timeout (to prevent a stuck migration from blocking the
 * deployment pipeline indefinitely).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'db-migration-runner-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.rollbackCommand) {
    violations.push({
      rule:   'rollbackCommand-required',
      reason: 'No rollbackCommand declared — a failed migration cannot be undone automatically',
      hint:   'Add rollbackCommand (e.g., "prisma migrate reset" or the equivalent undo command for your tool)',
    });
  }
  if (!spec.timeoutSeconds) {
    violations.push({
      rule:   'timeoutSeconds-required',
      reason: 'No timeoutSeconds declared — a stuck migration will block the deployment pipeline indefinitely',
      hint:   'Add timeoutSeconds (e.g., 300 for 5 minutes — tune based on expected migration duration)',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'MR007',
      message: `${violations.length} contract violation(s) in db-migration-runner-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'MR007', message: 'Migration runner contract satisfied' };
}
