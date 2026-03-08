import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** IV001 — spec-valid: required fields and structure */
export async function run({ dir }) {
  const specPath = join(dir, 'input-validation-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'IV001', message: 'No input-validation-policy.json found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'IV001', message: 'input-validation-policy.json is not valid JSON', detail: err.message };
  }

  const violations = [];

  if (!spec.feature || typeof spec.feature !== 'string') {
    violations.push('Missing or invalid field: feature');
  }
  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    violations.push('Missing or invalid field: fields (must be a non-empty array)');
  }

  if (Array.isArray(spec.fields)) {
    const REQUIRED = ['id', 'name', 'type'];
    spec.fields.forEach((field, i) => {
      REQUIRED.forEach(req => {
        if (!field[req]) violations.push(`fields[${i}] (id: ${field.id || '?'}): missing required field "${req}"`);
      });
    });
  }

  if (violations.length > 0) {
    return { pass: false, code: 'IV001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'IV001', message: `Spec valid — ${spec.fields.length} field(s) declared` };
}
