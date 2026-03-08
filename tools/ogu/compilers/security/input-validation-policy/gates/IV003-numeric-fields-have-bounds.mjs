import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** IV003 — numeric-fields-have-bounds: numeric fields must declare min and max bounds */
export async function run({ dir }) {
  const specPath = join(dir, 'input-validation-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'IV003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IV003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields)) {
    return { pass: true, code: 'IV003', message: 'No fields — gate skipped', skipped: true };
  }

  const NUMERIC_TYPES = new Set(['number', 'integer', 'float', 'decimal', 'int', 'long', 'double', 'amount', 'price', 'quantity', 'count', 'age', 'year']);
  const violations = [];

  for (const field of spec.fields) {
    const id = field.id || '?';
    const type = String(field.type || '').toLowerCase();
    if (!NUMERIC_TYPES.has(type)) continue;

    if (field.min === undefined || field.min === null) {
      violations.push(`Field "${id}" (type: ${field.type}): min must be defined for numeric fields`);
    }
    if (field.max === undefined || field.max === null) {
      violations.push(`Field "${id}" (type: ${field.type}): max must be defined for numeric fields`);
    }
    if (field.min !== undefined && field.max !== undefined && typeof field.min === 'number' && typeof field.max === 'number') {
      if (field.min >= field.max) {
        violations.push(`Field "${id}": min (${field.min}) must be less than max (${field.max})`);
      }
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'IV003', message: `${violations.length} numeric field(s) missing bounds`, detail: violations.join('\n') };
  }

  const numericCount = spec.fields.filter(f => NUMERIC_TYPES.has(String(f.type || '').toLowerCase())).length;
  if (numericCount === 0) return { pass: true, code: 'IV003', message: 'No numeric fields — gate skipped', skipped: true };
  return { pass: true, code: 'IV003', message: `Bounds defined for all ${numericCount} numeric field(s)` };
}
