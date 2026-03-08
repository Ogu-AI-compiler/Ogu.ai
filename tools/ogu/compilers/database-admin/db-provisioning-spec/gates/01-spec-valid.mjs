/**
 * Gate: spec-valid (DPS001)
 * Validates that db-provisioning-spec.json exists, is valid JSON, and contains
 * all required top-level fields. Missing fields silently break every downstream gate.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_FIELDS = [
  'platform',
  'engine',
  'engine_version',
  'instance_class',
  'storage_type',
  'storage_size_gb',
  'multi_az',
  'deletion_protection',
  'encryption_at_rest',
  'backup_retention_days',
  'ha_tier',
];

const VALID_PLATFORMS = ['aws-rds', 'gcp-cloud-sql', 'azure-database', 'supabase', 'neon', 'self-hosted'];
const VALID_STORAGE_TYPES = ['gp2', 'gp3', 'io1', 'io2', 'magnetic', 'ssd', 'serverless'];
const VALID_HA_TIERS = ['development', 'staging', 'production'];

export async function run({ dir }) {
  const specPath = join(dir, 'db-provisioning-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'DPS001',
      message: 'db-provisioning-spec.json not found',
      detail: `Expected at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {
      pass: false,
      code: 'DPS001',
      message: `db-provisioning-spec.json is not valid JSON: ${e.message}`,
    };
  }

  const missing = REQUIRED_FIELDS.filter(f => !(f in spec));
  if (missing.length > 0) {
    return {
      pass: false,
      code: 'DPS001',
      message: `Missing required field(s): ${missing.join(', ')}`,
      detail: `Required: ${REQUIRED_FIELDS.join(', ')}`,
    };
  }

  const violations = [];

  if (!VALID_PLATFORMS.includes(spec.platform)) {
    violations.push(`platform "${spec.platform}" is not a recognised value (${VALID_PLATFORMS.join(', ')})`);
  }

  if (spec.engine !== 'postgres') {
    violations.push(`engine must be "postgres", got "${spec.engine}"`);
  }

  if (!VALID_STORAGE_TYPES.includes(spec.storage_type)) {
    violations.push(`storage_type "${spec.storage_type}" is not a recognised value (${VALID_STORAGE_TYPES.join(', ')})`);
  }

  if (!VALID_HA_TIERS.includes(spec.ha_tier)) {
    violations.push(`ha_tier "${spec.ha_tier}" must be one of: ${VALID_HA_TIERS.join(', ')}`);
  }

  if (typeof spec.storage_size_gb !== 'number' || spec.storage_size_gb <= 0) {
    violations.push('storage_size_gb must be a positive number');
  }

  if (typeof spec.backup_retention_days !== 'number' || spec.backup_retention_days < 0) {
    violations.push('backup_retention_days must be a non-negative number');
  }

  if (typeof spec.multi_az !== 'boolean') {
    violations.push('multi_az must be a boolean');
  }

  if (typeof spec.deletion_protection !== 'boolean') {
    violations.push('deletion_protection must be a boolean');
  }

  if (typeof spec.encryption_at_rest !== 'boolean') {
    violations.push('encryption_at_rest must be a boolean');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'DPS001',
      message: `Spec has ${violations.length} field-level error(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'DPS001',
    message: `Spec valid — ${spec.platform} / ${spec.engine} ${spec.engine_version} / ha_tier: ${spec.ha_tier}`,
  };
}
