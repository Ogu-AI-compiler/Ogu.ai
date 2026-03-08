/**
 * Gate: reserve-pool (CPC007)
 * reserve_pool_size must be > 0. The reserve pool provides emergency connections
 * that PgBouncer uses when all regular pool slots are occupied, preventing a
 * total connection blackout under traffic spikes.
 *
 * A reserve pool of 0 means that when all pool slots are full, all new client
 * connections are rejected until a slot frees up — no graceful degradation.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CPC007', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CPC007', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (spec.reserve_pool_size === undefined || spec.reserve_pool_size === null) {
    return {
      pass: false,
      code: 'CPC007',
      message: 'reserve_pool_size is required',
      detail: 'Set reserve_pool_size to a positive number (recommended: 5–10% of default_pool_size).',
    };
  }

  if (typeof spec.reserve_pool_size !== 'number') {
    return {
      pass: false,
      code: 'CPC007',
      message: `reserve_pool_size must be a number, got: ${typeof spec.reserve_pool_size}`,
    };
  }

  if (spec.reserve_pool_size <= 0) {
    return {
      pass: false,
      code: 'CPC007',
      message: `reserve_pool_size must be > 0, got: ${spec.reserve_pool_size}`,
      detail:
        'A reserve pool of 0 means no emergency connections are available during traffic spikes.\n' +
        'All new clients are hard-rejected when the pool is full.\n' +
        'Set reserve_pool_size >= 1 to enable graceful degradation.',
    };
  }

  return {
    pass: true,
    code: 'CPC007',
    message: `reserve_pool_size: ${spec.reserve_pool_size} (emergency connections available)`,
  };
}
