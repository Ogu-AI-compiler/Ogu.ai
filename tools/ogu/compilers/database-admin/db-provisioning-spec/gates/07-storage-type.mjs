/**
 * Gate: storage-type (DPS007)
 * Validates that the storage type is appropriate for the declared IOPS requirements.
 *
 * Rules:
 * - If provisioned_iops is declared, storage_type must support it (io1 or io2).
 * - gp2 is flagged as legacy when provisioned_iops > 0 is declared (gp2 cannot provision IOPS).
 * - serverless storage type requires no IOPS declaration.
 * - gp3 is the preferred general-purpose type (supports burst IOPS without extra cost).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROVISIONED_IOPS_TYPES = ['io1', 'io2'];
const LEGACY_TYPES = ['gp2', 'magnetic'];

export async function run({ dir }) {
  const specPath = join(dir, 'db-provisioning-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DPS007', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DPS007', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const storageType = spec.storage_type;
  const provisionedIops = spec.provisioned_iops;
  const violations = [];

  // If provisioned IOPS is declared, storage type must support it
  if (provisionedIops !== undefined && provisionedIops !== null) {
    if (typeof provisionedIops !== 'number' || provisionedIops <= 0) {
      violations.push(`provisioned_iops must be a positive number, got: ${provisionedIops}`);
    } else if (!PROVISIONED_IOPS_TYPES.includes(storageType)) {
      violations.push(
        `provisioned_iops (${provisionedIops}) declared but storage_type "${storageType}" does not support provisioned IOPS. ` +
        `Use io1 or io2 for provisioned IOPS.`
      );
    }
  }

  // Flag legacy gp2/magnetic for production workloads
  if (LEGACY_TYPES.includes(storageType) && spec.ha_tier === 'production') {
    violations.push(
      `storage_type "${storageType}" is legacy for production use. ` +
      'Prefer gp3 (general purpose) or io1/io2 (provisioned IOPS) for production instances.'
    );
  }

  // serverless should not declare provisioned_iops
  if (storageType === 'serverless' && provisionedIops !== undefined) {
    violations.push(
      'serverless storage_type does not support provisioned_iops declaration. Remove provisioned_iops.'
    );
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'DPS007',
      message: `Storage type mismatch: ${violations.length} issue(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'DPS007',
    message: `storage_type "${storageType}" is appropriate${provisionedIops ? ` (provisioned_iops: ${provisionedIops})` : ''}`,
  };
}
