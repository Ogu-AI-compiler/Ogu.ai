import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH004 — no-plaintext-logging: log_safe must be false for all secrets */
export async function run({ dir }) {
  const specPath = join(dir, 'secret-handling-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'SH004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SH004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.secrets)) {
    return { pass: true, code: 'SH004', message: 'No secrets array — gate skipped', skipped: true };
  }

  const violations = [];

  for (const secret of spec.secrets) {
    const id = secret.id || '?';
    // log_safe: true means "safe to log in plaintext" — this must never be true for a real secret
    if (secret.log_safe !== false) {
      violations.push(`Secret "${id}": log_safe must be explicitly false — found: ${JSON.stringify(secret.log_safe)}`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SH004',
      message: `${violations.length} secret(s) allow plaintext logging (log_safe is not false)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'SH004', message: `Plaintext logging prohibited for all ${spec.secrets.length} secret(s)` };
}
