/**
 * Gate: pool-mode (CPC002)
 * pool_mode must be one of the three valid PgBouncer modes.
 * Each mode has different semantics — an invalid mode silently falls back to
 * session mode, which is rarely what's intended for high-concurrency apps.
 *
 * - session: one server connection per client connection (default, safest)
 * - transaction: server connection released after each transaction (recommended for microservices)
 * - statement: server connection released after each statement (rare, incompatible with multi-statement transactions)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_POOL_MODES = ['session', 'transaction', 'statement'];

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CPC002', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CPC002', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!spec.pool_mode) {
    return {
      pass: false,
      code: 'CPC002',
      message: 'pool_mode is required',
      detail: `Must be one of: ${VALID_POOL_MODES.join(', ')}`,
    };
  }

  if (!VALID_POOL_MODES.includes(spec.pool_mode)) {
    return {
      pass: false,
      code: 'CPC002',
      message: `pool_mode "${spec.pool_mode}" is not a valid value`,
      detail: `Valid values: ${VALID_POOL_MODES.join(', ')}\n` +
              'Use "transaction" for most microservice workloads. ' +
              'Use "session" when clients use advisory locks, LISTEN/NOTIFY, or prepared statements.',
    };
  }

  return {
    pass: true,
    code: 'CPC002',
    message: `pool_mode "${spec.pool_mode}" is valid`,
  };
}
