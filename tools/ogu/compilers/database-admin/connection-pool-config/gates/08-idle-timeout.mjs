/**
 * Gate: idle-timeout (CPC008)
 * server_idle_timeout must be defined and > 0.
 * When a server connection sits idle longer than this threshold, PgBouncer
 * closes it and returns the slot to the pool. Without a timeout, idle
 * connections accumulate and block legitimate requests from obtaining slots.
 *
 * server_idle_timeout is in seconds. Recommended: 600 (10 minutes).
 * Values < 30 cause excessive connection churn. 0 means no timeout (bad).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIN_RECOMMENDED_TIMEOUT = 30;

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CPC008', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CPC008', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (spec.server_idle_timeout === undefined || spec.server_idle_timeout === null) {
    return {
      pass: false,
      code: 'CPC008',
      message: 'server_idle_timeout is required',
      detail:
        'Without server_idle_timeout, idle server connections accumulate and block pool slots.\n' +
        'Recommended: 600 (seconds).',
    };
  }

  if (typeof spec.server_idle_timeout !== 'number') {
    return {
      pass: false,
      code: 'CPC008',
      message: `server_idle_timeout must be a number (seconds), got: ${typeof spec.server_idle_timeout}`,
    };
  }

  if (spec.server_idle_timeout <= 0) {
    return {
      pass: false,
      code: 'CPC008',
      message: `server_idle_timeout must be > 0, got: ${spec.server_idle_timeout}`,
      detail:
        'A timeout of 0 means idle server connections are never closed.\n' +
        'This causes connection exhaustion under sustained load.',
    };
  }

  if (spec.server_idle_timeout < MIN_RECOMMENDED_TIMEOUT) {
    return {
      pass: false,
      code: 'CPC008',
      message: `server_idle_timeout (${spec.server_idle_timeout}s) is below minimum recommended (${MIN_RECOMMENDED_TIMEOUT}s)`,
      detail:
        `Very short idle timeouts cause excessive connection open/close churn,\n` +
        `increasing PostgreSQL pg_hba.conf auth overhead and connection latency.\n` +
        `Set server_idle_timeout >= ${MIN_RECOMMENDED_TIMEOUT} seconds.`,
    };
  }

  return {
    pass: true,
    code: 'CPC008',
    message: `server_idle_timeout: ${spec.server_idle_timeout}s`,
  };
}
