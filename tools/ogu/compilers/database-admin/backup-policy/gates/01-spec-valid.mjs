/**
 * Gate: spec-valid (DBP001)
 * Validates that backup-policy.json exists, is valid JSON, and contains
 * all required fields for a valid backup policy.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = [
  'snapshot_frequency',
  'pitr_window',
  'retention_days',
  'rpo_hours',
  'rto_hours',
  'geo_redundant',
  'wal_archiving',
];

export async function run({ dir }) {
  const specPath = join(dir, 'backup-policy.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'DBP001',
      message: 'backup-policy.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'DBP001',
      message: `backup-policy.json is not valid JSON: ${e.message}`,
    };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in spec));
  if (missing.length > 0) {
    return {
      pass: false,
      code: 'DBP001',
      message: `Missing required field(s): ${missing.join(', ')}`,
      detail: `Required: ${REQUIRED_FIELDS.join(', ')}`,
    };
  }

  const violations = [];

  if (typeof spec.rpo_hours !== 'number' || spec.rpo_hours <= 0) {
    violations.push('rpo_hours must be a positive number');
  }

  if (typeof spec.rto_hours !== 'number' || spec.rto_hours <= 0) {
    violations.push('rto_hours must be a positive number');
  }

  if (typeof spec.retention_days !== 'number' || spec.retention_days <= 0) {
    violations.push('retention_days must be a positive number');
  }

  if (typeof spec.geo_redundant !== 'boolean') {
    violations.push('geo_redundant must be a boolean');
  }

  if (typeof spec.wal_archiving !== 'boolean') {
    violations.push('wal_archiving must be a boolean');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'DBP001',
      message: `${violations.length} field-level error(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'DBP001',
    message: `Spec valid — RPO: ${spec.rpo_hours}h, RTO: ${spec.rto_hours}h, retention: ${spec.retention_days}d`,
  };
}
