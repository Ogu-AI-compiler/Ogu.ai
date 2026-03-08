import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA083 — no-shared-db-isolation
 * Tests must not share a single database instance without isolation.
 *
 * Shared DB problems:
 *   - Test A creates user → Test B reads and finds unexpected data
 *   - Parallel test runs corrupt each other's state
 *   - Tests pass locally (sequential) but fail in CI (parallel)
 *   - Test order becomes significant — non-deterministic failures
 *
 * Valid isolation strategies:
 *   transaction-rollback  — wrap each test in a transaction, roll back after
 *   per-test-db           — each test gets its own database instance
 *   per-suite-db          — each test suite gets its own database instance
 *   truncate-between      — truncate tables between tests (slower but simple)
 *   in-memory             — use in-memory DB (SQLite :memory:, in-memory Mongo)
 *   docker-per-suite      — new Docker container per test suite
 *
 * Invalid (forbidden):
 *   shared                — all tests share one DB with no isolation
 *   none                  — no isolation declared
 */

const VALID_ISOLATION_STRATEGIES = new Set([
  'transaction-rollback', 'per-test-db', 'per-suite-db', 'truncate-between',
  'in-memory', 'docker-per-suite', 'savepoint-rollback', 'schema-per-test',
]);

const FORBIDDEN_STRATEGIES = new Set(['shared', 'none', 'manual-cleanup', 'best-effort']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'test-data-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA083', message: 'test-data-policy-spec.json not readable' }; }

  const isolation = spec.isolation;
  if (!isolation || typeof isolation !== 'object') {
    return { pass: false, code: 'QA083', message: 'spec.isolation not declared' };
  }

  const strategy = isolation.strategy;
  if (!strategy) {
    return { pass: false, code: 'QA083', message: 'isolation.strategy is required' };
  }

  if (FORBIDDEN_STRATEGIES.has(strategy)) {
    return {
      pass: false, code: 'QA083',
      message: `isolation.strategy "${strategy}" is forbidden — tests will interfere with each other`,
      detail: `Valid isolation strategies: ${[...VALID_ISOLATION_STRATEGIES].join(', ')}`,
    };
  }

  if (!VALID_ISOLATION_STRATEGIES.has(strategy)) {
    return {
      pass: false, code: 'QA083',
      message: `isolation.strategy "${strategy}" not recognised`,
      detail: `Valid strategies: ${[...VALID_ISOLATION_STRATEGIES].join(', ')}`,
    };
  }

  // Parallel safety check
  if (isolation.parallelSafe === false) {
    return {
      pass: false, code: 'QA083',
      message: `isolation.parallelSafe: false — strategy "${strategy}" is not parallel-safe`,
      detail: 'Tests that run in parallel in CI must be safe for concurrent execution.',
    };
  }

  const parallelStr = isolation.parallelSafe === true ? ', parallel-safe' : '';
  return {
    pass: true, code: 'QA083',
    message: `isolation.strategy: "${strategy}"${parallelStr}`,
  };
}
