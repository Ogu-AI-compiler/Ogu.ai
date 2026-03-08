import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA080 — spec-valid
 * test-data-policy-spec.json must declare:
 *   - strategy: how test data is sourced and managed
 *   - isolation: how test runs are isolated from each other and production
 *   - piiPolicy: explicit policy on PII in test data
 *
 * Valid strategies: factories, fixtures, snapshots, mocks, seeders, generated
 * (these can be combined — spec.strategy can be an array)
 */

const VALID_STRATEGIES = new Set(['factories', 'fixtures', 'snapshots', 'mocks', 'seeders', 'generated', 'synthetic']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'test-data-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA080', message: 'test-data-policy-spec.json not found or not valid JSON' }; }

  // strategy: string or array
  const strategies = Array.isArray(spec.strategy) ? spec.strategy : (spec.strategy ? [spec.strategy] : []);
  if (strategies.length === 0) {
    return {
      pass: false, code: 'QA080',
      message: 'spec.strategy is required',
      detail: `Valid strategies: ${[...VALID_STRATEGIES].join(', ')}`,
    };
  }
  const invalidStrategies = strategies.filter(s => !VALID_STRATEGIES.has(s));
  if (invalidStrategies.length) {
    return {
      pass: false, code: 'QA080',
      message: `Invalid strategies: ${invalidStrategies.join(', ')}`,
      detail: `Valid: ${[...VALID_STRATEGIES].join(', ')}`,
    };
  }

  // isolation
  if (!spec.isolation || typeof spec.isolation !== 'object') {
    return {
      pass: false, code: 'QA080',
      message: 'spec.isolation is required (object describing DB/state isolation strategy)',
    };
  }

  if (!spec.isolation.strategy || typeof spec.isolation.strategy !== 'string') {
    return { pass: false, code: 'QA080', message: 'spec.isolation.strategy is required (string)' };
  }

  // piiPolicy
  if (!spec.piiPolicy || typeof spec.piiPolicy !== 'object') {
    return {
      pass: false, code: 'QA080',
      message: 'spec.piiPolicy is required — document how PII is handled in test data',
    };
  }

  return {
    pass: true, code: 'QA080',
    message: `Spec valid — strategies: [${strategies.join(', ')}], isolation: ${spec.isolation.strategy}`,
  };
}
