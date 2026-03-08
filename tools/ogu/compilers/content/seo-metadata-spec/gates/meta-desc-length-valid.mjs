import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SMS004 — meta-desc-length-valid: metaDescriptionMaxLength must be declared and within 120–155 chars */
export async function run({ dir }) {
  const specPath = join(dir, 'seo-metadata-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'SMS004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SMS004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contentTypes) || spec.contentTypes.length === 0) {
    return { pass: true, code: 'SMS004', message: 'No contentTypes — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ct of spec.contentTypes) {
    const maxLen = ct.metaDescriptionMaxLength;

    if (maxLen === undefined) {
      violations.push(`"${ct.typeId}": metaDescriptionMaxLength not declared`);
      continue;
    }

    if (typeof maxLen !== 'number') {
      violations.push(`"${ct.typeId}": metaDescriptionMaxLength must be a number, got ${typeof maxLen}`);
      continue;
    }

    if (maxLen < 120 || maxLen > 155) {
      violations.push(
        `"${ct.typeId}": metaDescriptionMaxLength=${maxLen} is outside the 120–155 character range`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SMS004',
      message: `${violations.length} content type(s) with invalid meta description length constraint`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'SMS004',
    message: `All ${spec.contentTypes.length} content type(s) have valid meta description length constraints (120–155)`,
  };
}
