/**
 * Gate: deletion-protection (DPS004)
 * All production instances must have deletion_protection: true.
 * Without it, a single CLI command or API call can destroy the entire database.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'db-provisioning-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DPS004', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DPS004', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  if (spec.ha_tier !== 'production') {
    return {
      pass: true,
      code: 'DPS004',
      message: `ha_tier is "${spec.ha_tier}" — deletion_protection check only applies to production`,
      skipped: true,
    };
  }

  if (spec.deletion_protection !== true) {
    return {
      pass: false,
      code: 'DPS004',
      message: 'Production instance must have deletion_protection: true',
      detail:
        'ha_tier is "production" but deletion_protection is not enabled.\n' +
        'Without deletion protection, a single API call can permanently destroy this database.\n' +
        'Set deletion_protection: true in db-provisioning-spec.json.',
    };
  }

  return {
    pass: true,
    code: 'DPS004',
    message: 'Production instance has deletion_protection: true',
  };
}
