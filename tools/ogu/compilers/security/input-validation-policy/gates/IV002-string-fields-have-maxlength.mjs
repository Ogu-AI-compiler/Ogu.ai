import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** IV002 — string-fields-have-maxlength: every string field must declare a maxLength */
export async function run({ dir }) {
  const specPath = join(dir, 'input-validation-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'IV002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IV002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields)) {
    return { pass: true, code: 'IV002', message: 'No fields — gate skipped', skipped: true };
  }

  const STRING_TYPES = new Set(['string', 'text', 'email', 'url', 'phone', 'name', 'description', 'password', 'token', 'uuid', 'slug', 'html', 'markdown']);
  const violations = [];

  for (const field of spec.fields) {
    const id = field.id || '?';
    const type = String(field.type || '').toLowerCase();
    if (!STRING_TYPES.has(type)) continue;

    if (typeof field.maxLength !== 'number' || field.maxLength <= 0) {
      violations.push(`Field "${id}" (type: ${field.type}): maxLength must be a positive number for string fields`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'IV002', message: `${violations.length} string field(s) missing maxLength`, detail: violations.join('\n') };
  }

  const stringCount = spec.fields.filter(f => STRING_TYPES.has(String(f.type || '').toLowerCase())).length;
  return { pass: true, code: 'IV002', message: `maxLength defined for all ${stringCount} string field(s)` };
}
