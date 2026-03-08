import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SMS003 — title-length-valid: title template max length must be declared and within 50–60 chars */
export async function run({ dir }) {
  const specPath = join(dir, 'seo-metadata-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'SMS003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SMS003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contentTypes) || spec.contentTypes.length === 0) {
    return { pass: true, code: 'SMS003', message: 'No contentTypes — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ct of spec.contentTypes) {
    const maxLen = ct.titleMaxLength;

    if (maxLen === undefined) {
      violations.push(`"${ct.typeId}": titleMaxLength not declared`);
      continue;
    }

    if (typeof maxLen !== 'number') {
      violations.push(`"${ct.typeId}": titleMaxLength must be a number, got ${typeof maxLen}`);
      continue;
    }

    if (maxLen < 50 || maxLen > 60) {
      violations.push(
        `"${ct.typeId}": titleMaxLength=${maxLen} is outside the 50–60 character range`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SMS003',
      message: `${violations.length} content type(s) with invalid title length constraint`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'SMS003',
    message: `All ${spec.contentTypes.length} content type(s) have valid title length constraints (50–60)`,
  };
}
