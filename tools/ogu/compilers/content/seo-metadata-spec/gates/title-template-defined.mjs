import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SMS002 — title-template-defined: every content type must have a titleTemplate defined */
export async function run({ dir }) {
  const specPath = join(dir, 'seo-metadata-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'SMS002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SMS002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contentTypes) || spec.contentTypes.length === 0) {
    return { pass: true, code: 'SMS002', message: 'No contentTypes — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ct of spec.contentTypes) {
    if (!ct.titleTemplate || typeof ct.titleTemplate !== 'string' || ct.titleTemplate.trim() === '') {
      violations.push(`"${ct.typeId}": missing or empty titleTemplate`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SMS002',
      message: `${violations.length} content type(s) missing titleTemplate`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'SMS002',
    message: `All ${spec.contentTypes.length} content type(s) have a titleTemplate`,
  };
}
