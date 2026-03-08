import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PC005 — no-duplicate-field-ids: each field id must be unique within the manifest */
export async function run({ dir }) {
  const specPath = join(dir, 'pii-classification.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'PC005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PC005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    return { pass: true, code: 'PC005', message: 'No fields array — gate skipped', skipped: true };
  }

  const seen = new Map();
  const violations = [];

  for (const field of spec.fields) {
    const id = field.id || `${field.entity}.${field.field_name}`;
    if (!id) continue;
    if (seen.has(id)) {
      violations.push(`Duplicate field id "${id}" — each field must appear exactly once in the manifest`);
    } else {
      seen.set(id, true);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PC005',
      message: `${violations.length} duplicate field id(s) found`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'PC005', message: `All ${spec.fields.length} field id(s) are unique` };
}
