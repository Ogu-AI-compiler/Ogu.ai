import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** EK001 — spec-valid: required fields and structure */
export async function run({ dir }) {
  const specPath = join(dir, 'encryption-key-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'EK001', message: 'No encryption-key-policy.json found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'EK001', message: 'encryption-key-policy.json is not valid JSON', detail: err.message };
  }

  const violations = [];

  if (!spec.project || typeof spec.project !== 'string') {
    violations.push('Missing or invalid field: project');
  }

  if (!Array.isArray(spec.keys)) {
    violations.push('Missing or invalid field: keys (must be an array)');
  } else if (spec.keys.length === 0) {
    violations.push('keys array is empty — at least one key policy must be declared');
  } else {
    const REQUIRED = ['id', 'algorithm', 'purpose', 'key_length_bits', 'rotation_days', 'storage_backend'];
    spec.keys.forEach((key, i) => {
      REQUIRED.forEach(field => {
        if (key[field] === undefined || key[field] === null || key[field] === '') {
          violations.push(`keys[${i}] (id: ${key.id || '?'}): missing required field "${field}"`);
        }
      });
      if (key.rotation_days !== undefined && (typeof key.rotation_days !== 'number' || key.rotation_days <= 0)) {
        violations.push(`keys[${i}] (id: ${key.id || '?'}): rotation_days must be a positive number`);
      }
      if (key.key_length_bits !== undefined && typeof key.key_length_bits !== 'number') {
        violations.push(`keys[${i}] (id: ${key.id || '?'}): key_length_bits must be a number`);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'EK001',
      message: `Spec validation failed: ${violations.length} violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'EK001', message: `Spec valid — ${spec.keys.length} key policy(ies) declared` };
}
