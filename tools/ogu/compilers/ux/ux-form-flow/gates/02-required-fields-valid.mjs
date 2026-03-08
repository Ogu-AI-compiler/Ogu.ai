/**
 * Gate UFF002 — required-fields-valid
 * Every field with required:true must have at least one validation rule in its `validations` array.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF002',
      message: 'form-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UFF002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    return {
      pass: true,
      code: 'UFF002',
      message: 'No fields to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const field of spec.fields) {
    if (field.required !== true) continue;

    const fieldLabel = `field(id="${field.id ?? field.name ?? 'unknown'}")`;

    if (!Array.isArray(field.validations) || field.validations.length === 0) {
      violations.push(
        `${fieldLabel} is required:true but has no validations array — ` +
        'required fields must declare at least one validation rule'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UFF002',
      message: `${violations.length} required field(s) missing validation rules`,
      detail: violations.join('\n'),
    };
  }

  const requiredCount = spec.fields.filter(f => f.required === true).length;
  return {
    pass: true,
    code: 'UFF002',
    message: `required-fields-valid: ${requiredCount} required field(s), all have validation rules`,
  };
}
