import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH003 — rotation-defined: every secret has a rotation policy */
export async function run({ dir }) {
  const specPath = join(dir, 'secret-handling-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'SH003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SH003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.secrets)) {
    return { pass: true, code: 'SH003', message: 'No secrets array — gate skipped', skipped: true };
  }

  const violations = [];

  for (const secret of spec.secrets) {
    const id = secret.id || '?';

    if (typeof secret.max_age_days !== 'number' || secret.max_age_days <= 0) {
      violations.push(`Secret "${id}": max_age_days must be a positive number`);
      continue;
    }

    // rotation_required: false is allowed only with an approved exemption record
    if (secret.rotation_required === false) {
      if (!secret.rotation_exemption_ref || typeof secret.rotation_exemption_ref !== 'string') {
        violations.push(`Secret "${id}": rotation_required is false but rotation_exemption_ref is missing — document the approved exception`);
      }
    }

    // Warn on suspiciously long rotation intervals for high-sensitivity types
    const HIGH_SENSITIVITY_TYPES = [
      'database_credential', 'signing_key', 'private_key', 'master_key', 'root_credential',
    ];
    if (HIGH_SENSITIVITY_TYPES.includes(secret.type) && secret.max_age_days > 90) {
      violations.push(`Secret "${id}" (type: ${secret.type}): max_age_days=${secret.max_age_days} exceeds 90-day maximum for high-sensitivity secret types`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SH003',
      message: `${violations.length} secret(s) have missing or invalid rotation policy`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'SH003', message: `Rotation policy defined for all ${spec.secrets.length} secret(s)` };
}
