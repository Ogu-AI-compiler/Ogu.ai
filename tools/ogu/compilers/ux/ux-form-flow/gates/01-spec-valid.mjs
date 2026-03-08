/**
 * Gate UFF001 — spec-valid
 * form-flow-spec.json must exist with:
 * - form_id (string)
 * - fields (array)
 * - submission (object)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF001',
      message: 'form-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UFF001',
      message: `form-flow-spec.json parse error: ${err.message}`,
    };
  }

  const missing = [];
  if (typeof spec.form_id !== 'string' || spec.form_id.trim() === '') {
    missing.push('form_id (string)');
  }
  if (!Array.isArray(spec.fields)) {
    missing.push('fields (array)');
  }
  if (typeof spec.submission !== 'object' || spec.submission === null || Array.isArray(spec.submission)) {
    missing.push('submission (object)');
  }

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'UFF001',
      message: `form-flow-spec.json missing required fields: ${missing.join(', ')}`,
    };
  }

  if (spec.fields.length === 0) {
    return {
      pass: false,
      code: 'UFF001',
      message: 'fields array is empty — a form must have at least one field',
    };
  }

  return {
    pass: true,
    code: 'UFF001',
    message: `spec-valid: form_id="${spec.form_id}", ${spec.fields.length} field(s)`,
  };
}
