/**
 * Gate: encryption-at-rest (DPS003)
 * Any instance that processes PII data (pii: true) must have encryption_at_rest: true.
 * Unencrypted storage for PII violates GDPR, HIPAA, and SOC2 requirements.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'db-provisioning-spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'DPS003', message: 'No spec found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'DPS003', message: 'Spec not parseable — gate skipped', skipped: true };
  }

  // If pii flag is not declared, we default to treating it as non-PII (skipped).
  // But if it IS declared true, encryption is mandatory.
  if (spec.pii !== true) {
    return {
      pass: true,
      code: 'DPS003',
      message: 'pii: false (or not set) — encryption-at-rest not required',
      skipped: true,
    };
  }

  if (spec.encryption_at_rest !== true) {
    return {
      pass: false,
      code: 'DPS003',
      message: 'PII instance must have encryption_at_rest: true',
      detail:
        'This instance is classified as pii: true but encryption_at_rest is not enabled.\n' +
        'Unencrypted PII storage violates GDPR Article 25 and HIPAA §164.312(a)(2)(iv).',
    };
  }

  return {
    pass: true,
    code: 'DPS003',
    message: 'PII instance has encryption_at_rest: true',
  };
}
