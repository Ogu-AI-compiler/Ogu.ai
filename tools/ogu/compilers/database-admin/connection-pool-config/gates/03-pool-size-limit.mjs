/**
 * Gate: pool-size-limit (CPC003)
 * The sum of all pool sizes plus the reserve_pool_size must not exceed
 * (max_db_connections - reserved_system_connections). Exceeding this causes
 * PostgreSQL to reject new connections with "too many connections" errors.
 *
 * We reserve 3 connections by default for superuser/admin/monitoring.
 * This can be overridden with reserved_system_connections in the spec.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DEFAULT_RESERVED_SYSTEM_CONNECTIONS = 3;

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CPC003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CPC003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.pools) || spec.pools.length === 0) {
    return { pass: true, code: 'CPC003', message: 'No pools declared — gate skipped', skipped: true };
  }

  if (typeof spec.max_db_connections !== 'number') {
    return { pass: true, code: 'CPC003', message: 'max_db_connections not declared — gate skipped', skipped: true };
  }

  const reserved = typeof spec.reserved_system_connections === 'number'
    ? spec.reserved_system_connections
    : DEFAULT_RESERVED_SYSTEM_CONNECTIONS;

  const usableConnections = spec.max_db_connections - reserved;

  // Sum of individual pool sizes (if declared per-pool), else use default_pool_size * pool count
  let totalPoolSize = 0;
  const violations = [];

  for (const pool of spec.pools) {
    const poolSize = typeof pool.pool_size === 'number' ? pool.pool_size : spec.default_pool_size;
    if (typeof poolSize !== 'number' || poolSize <= 0) {
      violations.push(`Pool "${pool.name || '(unnamed)'}" has invalid pool_size: ${poolSize}`);
      continue;
    }
    totalPoolSize += poolSize;
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CPC003',
      message: `Pool size declaration error(s)`,
      detail: violations.join('\n'),
    };
  }

  const reservePoolSize = typeof spec.reserve_pool_size === 'number' ? spec.reserve_pool_size : 0;
  const totalRequired = totalPoolSize + reservePoolSize;

  if (totalRequired > usableConnections) {
    return {
      pass: false,
      code: 'CPC003',
      message: `Total pool size (${totalRequired}) exceeds usable connections (${usableConnections})`,
      detail:
        `max_db_connections: ${spec.max_db_connections}\n` +
        `reserved_system_connections: ${reserved}\n` +
        `usable_connections: ${usableConnections}\n` +
        `sum of pool sizes: ${totalPoolSize}\n` +
        `reserve_pool_size: ${reservePoolSize}\n` +
        `total required: ${totalRequired}\n` +
        'Reduce pool sizes or increase max_db_connections on the instance.',
    };
  }

  return {
    pass: true,
    code: 'CPC003',
    message: `Total pool size (${totalRequired}) is within usable connections (${usableConnections})`,
  };
}
