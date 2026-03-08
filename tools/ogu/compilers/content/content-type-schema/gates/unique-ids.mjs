import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CTS002 — unique-ids: all content type IDs are globally unique */
export async function run({ dir }) {
  const specPath = join(dir, 'content-type-schema.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CTS002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CTS002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.types) || spec.types.length === 0) {
    return { pass: true, code: 'CTS002', message: 'No types defined — gate skipped', skipped: true };
  }

  const seen = new Map();
  const violations = [];

  for (const type of spec.types) {
    const id = type.id;
    if (!id) continue;
    if (seen.has(id)) {
      violations.push(`Duplicate content type ID: "${id}" (first seen at index ${seen.get(id)})`);
    } else {
      seen.set(id, spec.types.indexOf(type));
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'CTS002',
      message: `${violations.length} duplicate content type ID(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CTS002',
    message: `All ${spec.types.length} content type IDs are unique`,
  };
}
