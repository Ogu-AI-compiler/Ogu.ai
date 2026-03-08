/**
 * Gate: max-client-connections (CPC004)
 * max_client_connections must be greater than the sum of all pool sizes.
 * This ensures that clients can queue when pool slots are full rather than
 * being immediately rejected with a "too many clients" error.
 *
 * If max_client_connections <= sum of pool sizes, clients can never queue —
 * any client arriving when all pool slots are busy gets a hard failure.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CPC004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CPC004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.pools) || spec.pools.length === 0) {
    return { pass: true, code: 'CPC004', message: 'No pools declared — gate skipped', skipped: true };
  }

  if (typeof spec.max_client_connections !== 'number') {
    return { pass: true, code: 'CPC004', message: 'max_client_connections not declared — gate skipped', skipped: true };
  }

  let totalPoolSize = 0;
  for (const pool of spec.pools) {
    const poolSize = typeof pool.pool_size === 'number' ? pool.pool_size : spec.default_pool_size;
    if (typeof poolSize === 'number' && poolSize > 0) {
      totalPoolSize += poolSize;
    }
  }

  if (spec.max_client_connections <= totalPoolSize) {
    return {
      pass: false,
      code: 'CPC004',
      message: `max_client_connections (${spec.max_client_connections}) must be > sum of pool sizes (${totalPoolSize})`,
      detail:
        `When max_client_connections <= total pool size, clients arriving at a full pool ` +
        `receive an immediate connection refused error instead of queuing.\n` +
        `Set max_client_connections > ${totalPoolSize} to enable client queuing.`,
    };
  }

  return {
    pass: true,
    code: 'CPC004',
    message: `max_client_connections (${spec.max_client_connections}) > pool size sum (${totalPoolSize}) — queuing enabled`,
  };
}
