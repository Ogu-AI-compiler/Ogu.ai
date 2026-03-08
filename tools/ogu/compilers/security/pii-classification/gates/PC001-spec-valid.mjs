import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PC001 — spec-valid: required fields and structure */
export async function run({ dir }) {
  const specPath = join(dir, 'pii-classification.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'PC001', message: 'No pii-classification.json found — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'PC001', message: 'pii-classification.json is not valid JSON', detail: err.message };
  }

  const violations = [];

  if (!spec.project || typeof spec.project !== 'string') {
    violations.push('Missing or invalid field: project (must be a non-empty string)');
  }

  if (!Array.isArray(spec.fields)) {
    violations.push('Missing or invalid field: fields (must be an array)');
  } else if (spec.fields.length === 0) {
    violations.push('fields array is empty — at least one field must be classified');
  } else {
    const VALID_LEVELS = new Set(['public', 'internal', 'sensitive', 'highly_sensitive']);
    const REQUIRED_FIELDS = ['id', 'entity', 'field_name', 'classification_level'];

    spec.fields.forEach((field, i) => {
      REQUIRED_FIELDS.forEach(reqField => {
        if (field[reqField] === undefined || field[reqField] === null || field[reqField] === '') {
          violations.push(`fields[${i}]: missing required field "${reqField}"`);
        }
      });
      if (field.classification_level && !VALID_LEVELS.has(field.classification_level)) {
        violations.push(`fields[${i}] (${field.id || '?'}): classification_level "${field.classification_level}" is not valid — must be one of: ${[...VALID_LEVELS].join(', ')}`);
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PC001',
      message: `Spec validation failed: ${violations.length} violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'PC001', message: `Spec valid — ${spec.fields.length} field(s) classified` };
}
