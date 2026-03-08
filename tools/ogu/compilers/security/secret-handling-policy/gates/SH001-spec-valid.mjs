import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH001 — spec-valid: required fields and structure */
export async function run({ dir }) {
  const specPath = join(dir, 'secret-handling-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'SH001', message: 'No secret-handling-policy.json found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'SH001', message: 'secret-handling-policy.json is not valid JSON', detail: err.message };
  }

  const violations = [];

  if (!spec.project || typeof spec.project !== 'string') {
    violations.push('Missing or invalid field: project (must be a non-empty string)');
  }

  if (!Array.isArray(spec.secrets)) {
    violations.push('Missing or invalid field: secrets (must be an array)');
  } else if (spec.secrets.length === 0) {
    violations.push('secrets array is empty — at least one secret must be declared');
  } else {
    const REQUIRED_SECRET_FIELDS = [
      'id', 'type', 'storage_backend', 'environments',
      'max_age_days', 'rotation_required', 'log_safe', 'allowed_consumers',
    ];
    spec.secrets.forEach((secret, i) => {
      REQUIRED_SECRET_FIELDS.forEach(field => {
        if (secret[field] === undefined || secret[field] === null) {
          violations.push(`secrets[${i}] (id: ${secret.id || '?'}): missing required field "${field}"`);
        }
      });

      if (secret.id !== undefined && typeof secret.id !== 'string') {
        violations.push(`secrets[${i}]: "id" must be a string`);
      }
      if (secret.environments !== undefined && !Array.isArray(secret.environments)) {
        violations.push(`secrets[${i}] (id: ${secret.id || '?'}): "environments" must be an array`);
      }
      if (secret.allowed_consumers !== undefined && !Array.isArray(secret.allowed_consumers)) {
        violations.push(`secrets[${i}] (id: ${secret.id || '?'}): "allowed_consumers" must be an array`);
      }
      if (secret.max_age_days !== undefined && (typeof secret.max_age_days !== 'number' || secret.max_age_days <= 0)) {
        violations.push(`secrets[${i}] (id: ${secret.id || '?'}): "max_age_days" must be a positive number`);
      }
      if (secret.rotation_required !== undefined && typeof secret.rotation_required !== 'boolean') {
        violations.push(`secrets[${i}] (id: ${secret.id || '?'}): "rotation_required" must be a boolean`);
      }
      if (secret.log_safe !== undefined && typeof secret.log_safe !== 'boolean') {
        violations.push(`secrets[${i}] (id: ${secret.id || '?'}): "log_safe" must be a boolean`);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SH001',
      message: `Spec validation failed: ${violations.length} violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'SH001', message: `Spec valid — ${spec.secrets.length} secret(s) declared` };
}
