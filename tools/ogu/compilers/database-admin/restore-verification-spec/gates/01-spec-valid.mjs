/**
 * Gate: spec-valid (RVS001)
 * Validates that restore-verification-spec.json exists and contains all
 * required fields. A backup that has never been verified is not a backup —
 * it's a hypothesis.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = [
  'rto_hours',
  'drill_schedule',
  'integrity_checks',
  'checksum_method',
];

export async function run({ dir }) {
  const specPath = join(dir, 'restore-verification-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'RVS001',
      message: 'restore-verification-spec.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'RVS001',
      message: `restore-verification-spec.json is not valid JSON: ${e.message}`,
    };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in spec));
  if (missing.length > 0) {
    return {
      pass: false,
      code: 'RVS001',
      message: `Missing required field(s): ${missing.join(', ')}`,
      detail: `Required: ${REQUIRED_FIELDS.join(', ')}`,
    };
  }

  const violations = [];

  if (typeof spec.rto_hours !== 'number' || spec.rto_hours <= 0) {
    violations.push('rto_hours must be a positive number');
  }

  if (!Array.isArray(spec.integrity_checks) || spec.integrity_checks.length === 0) {
    violations.push('integrity_checks must be a non-empty array of table/check definitions');
  }

  if (typeof spec.checksum_method !== 'string' || spec.checksum_method.trim() === '') {
    violations.push('checksum_method must be a non-empty string');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'RVS001',
      message: `${violations.length} field-level error(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'RVS001',
    message: `Spec valid — RTO: ${spec.rto_hours}h, ${spec.integrity_checks.length} integrity check(s)`,
  };
}
