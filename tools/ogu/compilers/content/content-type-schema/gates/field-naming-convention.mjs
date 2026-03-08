import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CTS007 — field-naming-convention: all field names must be camelCase */
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;

export async function run({ dir }) {
  const specPath = join(dir, 'content-type-schema.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CTS007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CTS007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.types) || spec.types.length === 0) {
    return { pass: true, code: 'CTS007', message: 'No types defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const type of spec.types) {
    if (!Array.isArray(type.fields)) continue;

    for (const field of type.fields) {
      if (!field.name) continue;

      if (!CAMEL_CASE.test(field.name)) {
        violations.push(
          `"${type.id}.${field.name}": field name violates camelCase convention`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CTS007',
      message: `${violations.length} field name(s) violate camelCase convention`,
      detail: violations.join('\n'),
    };
  }

  const totalFields = spec.types.reduce((sum, t) => sum + (t.fields || []).length, 0);
  return {
    pass: true,
    code: 'CTS007',
    message: `All ${totalFields} field name(s) follow camelCase convention`,
  };
}
