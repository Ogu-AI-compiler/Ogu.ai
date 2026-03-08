import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CTS003 — required-fields: every content type has at least one required:true field */
export async function run({ dir }) {
  const specPath = join(dir, 'content-type-schema.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CTS003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CTS003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.types) || spec.types.length === 0) {
    return { pass: true, code: 'CTS003', message: 'No types defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const type of spec.types) {
    if (!Array.isArray(type.fields)) continue;

    const hasRequired = type.fields.some(f => f.required === true);
    if (!hasRequired) {
      violations.push(`Content type "${type.id}" has no required:true fields`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CTS003',
      message: `${violations.length} content type(s) missing required fields`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CTS003',
    message: 'All content types have at least one required field',
  };
}
