import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PC003 — highly-sensitive-encrypted: fields classified as highly_sensitive must declare encryption */
export async function run({ dir }) {
  const specPath = join(dir, 'pii-classification.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'PC003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PC003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields)) {
    return { pass: true, code: 'PC003', message: 'No fields array — gate skipped', skipped: true };
  }

  const highlyeSensitiveFields = spec.fields.filter(f => f.classification_level === 'highly_sensitive');
  if (highlyeSensitiveFields.length === 0) {
    return { pass: true, code: 'PC003', message: 'No highly_sensitive fields — gate skipped', skipped: true };
  }

  const violations = [];

  for (const field of highlyeSensitiveFields) {
    const id = field.id || `${field.entity}.${field.field_name}` || '?';

    if (!field.encryption_key_ref || typeof field.encryption_key_ref !== 'string' || field.encryption_key_ref.trim() === '') {
      violations.push(`Field "${id}" (highly_sensitive): must declare encryption_key_ref pointing to a key in the secret-handling-policy`);
    }

    if (!field.storage_encrypted || field.storage_encrypted !== true) {
      violations.push(`Field "${id}" (highly_sensitive): storage_encrypted must be true`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PC003',
      message: `${violations.length} highly_sensitive field(s) missing encryption declaration`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'PC003', message: `All ${highlyeSensitiveFields.length} highly_sensitive field(s) declare encryption` };
}
