/**
 * Gate: spec-valid (QPB001)
 * Validates that query-performance-budget.json exists, is valid JSON, and
 * contains all required fields.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = ['workloads', 'max_transaction_duration'];

export async function run({ dir }) {
  const specPath = join(dir, 'query-performance-budget.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'QPB001',
      message: 'query-performance-budget.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'QPB001',
      message: `query-performance-budget.json is not valid JSON: ${e.message}`,
    };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in spec));
  if (missing.length > 0) {
    return {
      pass: false,
      code: 'QPB001',
      message: `Missing required field(s): ${missing.join(', ')}`,
      detail: `Required: ${REQUIRED_FIELDS.join(', ')}`,
    };
  }

  const violations = [];

  if (typeof spec.workloads !== 'object' || spec.workloads === null || Array.isArray(spec.workloads)) {
    violations.push('workloads must be an object mapping workload names to their configurations');
  } else if (Object.keys(spec.workloads).length === 0) {
    violations.push('workloads must contain at least one workload class (e.g., oltp, reports, background)');
  }

  if (!spec.max_transaction_duration) {
    violations.push('max_transaction_duration is required');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'QPB001',
      message: `${violations.length} field-level error(s)`,
      detail: violations.join('\n'),
    };
  }

  const workloadCount = Object.keys(spec.workloads).length;
  return {
    pass: true,
    code: 'QPB001',
    message: `Spec valid — ${workloadCount} workload class(es), max_transaction_duration: ${spec.max_transaction_duration}`,
  };
}
