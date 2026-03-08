import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DV008 — contract-validation
 * Verifies that data validation modules satisfy the validation contract:
 * schema framework used, failures raise or log, no silent swallowing.
 *
 * Why:
 * - A validation module that does not use a schema framework is not a
 *   validation module — it is ad-hoc checks that drift from the actual
 *   data shape, lack coverage tracking, and cannot be shared or reused.
 * - Silent failure in validation is worse than no validation: it provides
 *   false confidence that data is clean when it may be corrupt.
 * - Raising on validation failure enables upstream callers to handle bad
 *   data explicitly; logging enables post-hoc auditing of what failed and when.
 *
 * Escape hatch: none — these are non-negotiable for production data pipelines.
 */

const RULES = [
  {
    id: 'has-schema',
    description: 'pandera DataFrameSchema or Great Expectations ExpectationSuite defined',
    test: c => /DataFrameSchema|ExpectationSuite|great_expectations|SchemaModel/.test(c),
  },
  {
    id: 'raises-on-failure',
    description: 'Validation failure raises exception or logs at ERROR/CRITICAL level',
    test: c => /raise\s|logger\.(?:critical|error)\s*\(|logging\.(?:critical|error)\s*\(/.test(c),
  },
];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) return { pass: false, code: 'DV008', message: 'No Python files found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = RULES.filter(r => !r.test(content));

  if (violations.length) {
    return {
      pass: false, code: 'DV008',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n'),
    };
  }

  return { pass: true, code: 'DV008', message: 'All validation contract rules passed' };
}
