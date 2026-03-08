import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CTS006 — image-alt-declared: image fields must declare whether alt text is required */
export async function run({ dir }) {
  const specPath = join(dir, 'content-type-schema.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CTS006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CTS006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.types) || spec.types.length === 0) {
    return { pass: true, code: 'CTS006', message: 'No types defined — gate skipped', skipped: true };
  }

  const imageFields = [];
  const violations = [];

  for (const type of spec.types) {
    if (!Array.isArray(type.fields)) continue;

    for (const field of type.fields) {
      if (field.type === 'image') {
        imageFields.push(`${type.id}.${field.name}`);

        // altRequired must be explicitly declared as true or false
        if (field.altRequired === undefined && field.altTextRequired === undefined) {
          violations.push(
            `"${type.id}.${field.name}": image field missing altRequired declaration (set true or false)`
          );
        }
      }
    }
  }

  if (imageFields.length === 0) {
    return {
      pass: true,
      code: 'CTS006',
      message: 'No image fields found — gate skipped',
      skipped: true,
    };
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CTS006',
      message: `${violations.length} image field(s) missing altRequired declaration`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CTS006',
    message: `All ${imageFields.length} image field(s) have altRequired declared`,
  };
}
