/**
 * Gate: health-check-query (CPC006)
 * health_check_query must be defined. PgBouncer uses it to verify that server
 * connections are alive before placing them back in the pool. Without it,
 * stale/broken server connections can silently accumulate in the pool and
 * cause "unexpected connection close" errors for application clients.
 *
 * Valid: "SELECT 1", "SELECT 1 AS health", ";", or any non-empty SQL string.
 * The query must be non-empty and not just whitespace.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CPC006', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CPC006', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (spec.health_check_query === undefined || spec.health_check_query === null) {
    return {
      pass: false,
      code: 'CPC006',
      message: 'health_check_query is required',
      detail:
        'PgBouncer uses health_check_query to verify server connections before reusing them.\n' +
        'Without it, broken connections silently accumulate in the pool.\n' +
        'Set health_check_query to "SELECT 1" or an equivalent lightweight query.',
    };
  }

  const query = String(spec.health_check_query).trim();

  if (query.length === 0) {
    return {
      pass: false,
      code: 'CPC006',
      message: 'health_check_query must not be empty',
      detail: 'Set health_check_query to "SELECT 1" or an equivalent lightweight query.',
    };
  }

  return {
    pass: true,
    code: 'CPC006',
    message: `health_check_query defined: "${query.slice(0, 40)}${query.length > 40 ? '...' : ''}"`,
  };
}
