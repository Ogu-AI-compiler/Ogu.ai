/**
 * Gate: spec-valid (CPC001)
 * Validates that connection-pool-config.json exists, is valid JSON, and
 * contains all required fields. This is the foundation gate — all other
 * pool gates depend on it.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = [
  'pool_mode',
  'max_client_connections',
  'default_pool_size',
  'reserve_pool_size',
  'server_idle_timeout',
  'auth_type',
  'health_check_query',
  'max_db_connections',
  'pools',
];

export async function run({ dir }) {
  const specPath = join(dir, 'connection-pool-config.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'CPC001',
      message: 'connection-pool-config.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'CPC001',
      message: `connection-pool-config.json is not valid JSON: ${e.message}`,
    };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in spec));
  if (missing.length > 0) {
    return {
      pass: false,
      code: 'CPC001',
      message: `Missing required field(s): ${missing.join(', ')}`,
      detail: `Required: ${REQUIRED_FIELDS.join(', ')}`,
    };
  }

  const violations = [];

  if (!Array.isArray(spec.pools)) {
    violations.push('pools must be an array of pool entries');
  } else if (spec.pools.length === 0) {
    violations.push('pools array must contain at least one pool entry');
  }

  if (typeof spec.max_client_connections !== 'number' || spec.max_client_connections <= 0) {
    violations.push('max_client_connections must be a positive number');
  }

  if (typeof spec.default_pool_size !== 'number' || spec.default_pool_size <= 0) {
    violations.push('default_pool_size must be a positive number');
  }

  if (typeof spec.max_db_connections !== 'number' || spec.max_db_connections <= 0) {
    violations.push('max_db_connections must be a positive number');
  }

  if (typeof spec.server_idle_timeout !== 'number') {
    violations.push('server_idle_timeout must be a number (seconds)');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CPC001',
      message: `Spec has ${violations.length} field-level error(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CPC001',
    message: `Spec valid — pool_mode: ${spec.pool_mode}, ${spec.pools.length} pool(s), max_db_connections: ${spec.max_db_connections}`,
  };
}
