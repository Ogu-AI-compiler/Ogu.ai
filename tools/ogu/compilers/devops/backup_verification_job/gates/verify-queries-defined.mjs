/**
 * Gate: verify-queries-defined (BV003)
 * Validates that at least one verification query is defined. Without queries,
 * the verification job cannot confirm that the restored backup contains valid
 * data — it can only verify that the restore process completed without error,
 * which does not confirm data integrity.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'backup-verify-spec.json'), 'utf8'));

  if (!Array.isArray(spec.verifyQueries) || spec.verifyQueries.length === 0) {
    return {
      pass: false, code: 'BV003',
      message: 'No verification queries defined — backup integrity cannot be confirmed',
      detail: {
        hint:    'Add at least one query to verifyQueries to check row counts or expected data after restore',
        example: '{ sql: "SELECT COUNT(*) FROM users", expectedMin: 1 }',
      },
    };
  }

  return { pass: true, code: 'BV003', message: `${spec.verifyQueries.length} verification query/queries defined` };
}
