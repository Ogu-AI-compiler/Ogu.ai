import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CTS004 — slug-unique-constraint: every slug field must declare unique:true */
export async function run({ dir }) {
  const specPath = join(dir, 'content-type-schema.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CTS004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CTS004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.types) || spec.types.length === 0) {
    return { pass: true, code: 'CTS004', message: 'No types defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const type of spec.types) {
    if (!Array.isArray(type.fields)) continue;

    for (const field of type.fields) {
      if (field.type === 'slug' && field.unique !== true) {
        violations.push(
          `"${type.id}.${field.name}" is type "slug" but missing unique:true`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CTS004',
      message: `${violations.length} slug field(s) missing unique:true constraint`,
      detail: violations.join('\n'),
    };
  }

  const slugFields = spec.types.flatMap(t =>
    (t.fields || []).filter(f => f.type === 'slug')
  );

  if (slugFields.length === 0) {
    return {
      pass: true,
      code: 'CTS004',
      message: 'No slug fields defined — gate skipped',
      skipped: true,
    };
  }

  return {
    pass: true,
    code: 'CTS004',
    message: `All ${slugFields.length} slug field(s) have unique:true`,
  };
}
