/**
 * Gate: retention-compliance (DBP004)
 * retention_days must meet the minimum requirement for the declared
 * compliance_tier. If no compliance_tier is declared, the baseline
 * minimum of 7 days for production applies.
 *
 * Compliance minimums:
 *   - baseline (no tier declared): 7 days for production
 *   - pci_dss: 90 days
 *   - hipaa: 365 days (6 years recommended, 1 year minimum)
 *   - gdpr: 30 days (data minimization applies, but audit logs need longer)
 *   - soc2: 90 days
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const COMPLIANCE_MINIMUMS = {
  baseline: 7,
  pci_dss: 90,
  hipaa: 365,
  gdpr: 30,
  soc2: 90,
};

export async function run({ dir }) {
  const specPath = join(dir, 'backup-policy.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DBP004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DBP004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  const complianceTier = spec.compliance_tier || 'baseline';
  const minDays = COMPLIANCE_MINIMUMS[complianceTier];

  if (minDays === undefined) {
    return {
      pass: false,
      code: 'DBP004',
      message: `Unknown compliance_tier "${complianceTier}"`,
      detail: `Valid tiers: ${Object.keys(COMPLIANCE_MINIMUMS).join(', ')}`,
    };
  }

  if (typeof spec.retention_days !== 'number') {
    return {
      pass: false,
      code: 'DBP004',
      message: 'retention_days must be a number',
    };
  }

  if (spec.retention_days < minDays) {
    return {
      pass: false,
      code: 'DBP004',
      message: `retention_days (${spec.retention_days}) is below the minimum for compliance_tier "${complianceTier}" (minimum: ${minDays})`,
      detail:
        `Compliance tier "${complianceTier}" requires at least ${minDays} days of backup retention.\n` +
        `Current value: ${spec.retention_days} days.\n` +
        `Increase retention_days to at least ${minDays}.`,
    };
  }

  return {
    pass: true,
    code: 'DBP004',
    message: `retention_days (${spec.retention_days}) meets "${complianceTier}" minimum (${minDays})`,
  };
}
