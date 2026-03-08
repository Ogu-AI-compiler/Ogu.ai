/**
 * Gate: multi-az (DPS005)
 * Production instances must have multi_az: true for high availability.
 * Single-AZ production databases have a single point of failure — any AZ outage
 * causes full downtime until the instance is manually moved.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'db-provisioning-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DPS005', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DPS005', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (spec.ha_tier !== 'production') {
    return {
      pass: true,
      code: 'DPS005',
      message: `ha_tier is "${spec.ha_tier}" — multi-AZ check only applies to production`,
      skipped: true,
    };
  }

  if (spec.multi_az !== true) {
    return {
      pass: false,
      code: 'DPS005',
      message: 'Production instance must have multi_az: true',
      detail:
        'ha_tier is "production" but multi_az is not enabled.\n' +
        'Single-AZ production databases are a single point of failure.\n' +
        'An AZ-level outage causes complete downtime until manual failover.\n' +
        'Set multi_az: true in db-provisioning-spec.json.',
    };
  }

  return {
    pass: true,
    code: 'DPS005',
    message: 'Production instance has multi_az: true',
  };
}
