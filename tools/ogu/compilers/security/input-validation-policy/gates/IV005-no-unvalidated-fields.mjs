import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** IV005 — no-unvalidated-fields: every field must have at least one validation rule */
export async function run({ dir }) {
  const specPath = join(dir, 'input-validation-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'IV005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IV005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    return { pass: true, code: 'IV005', message: 'No fields — gate skipped', skipped: true };
  }

  const violations = [];

  for (const field of spec.fields) {
    const id = field.id || '?';

    // A field has validation if it has any of these properties
    const hasValidation =
      field.required !== undefined ||
      field.maxLength !== undefined ||
      field.minLength !== undefined ||
      field.max !== undefined ||
      field.min !== undefined ||
      field.pattern !== undefined ||
      field.enum !== undefined ||
      field.format !== undefined ||
      field.sanitize !== undefined ||
      field.sanitization !== undefined ||
      (Array.isArray(field.rules) && field.rules.length > 0);

    if (!hasValidation) {
      violations.push(`Field "${id}": has no validation rules — declare at least one of: required, maxLength, min/max, pattern, enum, format, or sanitize`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'IV005', message: `${violations.length} field(s) have no validation rules`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'IV005', message: `All ${spec.fields.length} field(s) have at least one validation rule` };
}
