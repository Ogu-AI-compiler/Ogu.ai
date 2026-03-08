import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH007 — no-hardcoded-values: secret values must not appear directly in the policy file */
export async function run({ dir }) {
  const specPath = join(dir, 'secret-handling-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'SH007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SH007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.secrets)) {
    return { pass: true, code: 'SH007', message: 'No secrets array — gate skipped', skipped: true };
  }

  const violations = [];

  // Fields that should never contain actual secret values
  const SUSPICIOUS_VALUE_PATTERN = /^(?:[A-Za-z0-9+/]{20,}={0,2}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|xox[bpra]-[0-9A-Za-z-]{20,}|eyJ[A-Za-z0-9_-]{10,}|[0-9a-f]{32,})/;

  for (const secret of spec.secrets) {
    const id = secret.id || '?';

    // Check for a "value" or "default_value" field — should never be present
    if ('value' in secret) {
      violations.push(`Secret "${id}": field "value" must not be present in the policy file — store values in the vault, not the spec`);
    }
    if ('default_value' in secret) {
      violations.push(`Secret "${id}": field "default_value" must not be present in the policy file`);
    }
    if ('plaintext' in secret) {
      violations.push(`Secret "${id}": field "plaintext" must not be present in the policy file`);
    }

    // Check any string field for patterns that look like real credentials
    for (const [key, val] of Object.entries(secret)) {
      if (typeof val === 'string' && SUSPICIOUS_VALUE_PATTERN.test(val)) {
        // Exclude the 'id', 'type', and 'storage_backend' fields from this check
        if (!['id', 'type', 'storage_backend'].includes(key)) {
          violations.push(`Secret "${id}": field "${key}" contains a value that looks like a real credential — remove it from the spec`);
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SH007',
      message: `${violations.length} hardcoded value(s) detected in policy file`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'SH007', message: 'No hardcoded secret values detected in policy file' };
}
