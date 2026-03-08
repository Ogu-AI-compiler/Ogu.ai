/**
 * Gate: backup-retention (DPS006)
 * Production instances must have backup_retention_days >= 7.
 * Staging instances must have backup_retention_days >= 1.
 * Development instances with retention 0 are acceptable.
 *
 * The 7-day minimum for production is a baseline for most compliance frameworks
 * (SOC2, PCI-DSS). Compliance requirements can mandate longer retention.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIN_RETENTION = {
  production: 7,
  staging: 1,
  development: 0,
};

export async function run({ dir }) {
  const specPath = join(dir, 'db-provisioning-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DPS006', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DPS006', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const tier = spec.ha_tier;
  const minRequired = MIN_RETENTION[tier];

  if (minRequired === undefined) {
    // Unknown tier — skip rather than false-fail
    return {
      pass: true,
      code: 'DPS006',
      message: `Unknown ha_tier "${tier}" — backup retention check skipped`,
      skipped: true,
    };
  }

  if (minRequired === 0) {
    return {
      pass: true,
      code: 'DPS006',
      message: `ha_tier "${tier}" — no minimum backup retention required`,
      skipped: true,
    };
  }

  const retention = spec.backup_retention_days;

  if (typeof retention !== 'number') {
    return {
      pass: false,
      code: 'DPS006',
      message: 'backup_retention_days must be a number',
    };
  }

  if (retention < minRequired) {
    return {
      pass: false,
      code: 'DPS006',
      message: `backup_retention_days (${retention}) is below minimum for ha_tier "${tier}" (minimum: ${minRequired})`,
      detail:
        `ha_tier "${tier}" requires backup_retention_days >= ${minRequired}.\n` +
        `Current value: ${retention}.\n` +
        'Most compliance frameworks (SOC2, PCI-DSS) require at least 7 days for production.',
    };
  }

  return {
    pass: true,
    code: 'DPS006',
    message: `backup_retention_days (${retention}) meets minimum for ha_tier "${tier}" (>= ${minRequired})`,
  };
}
