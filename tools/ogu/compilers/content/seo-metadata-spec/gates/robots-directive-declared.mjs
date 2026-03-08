import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** SMS006 — robots-directive-declared: robots directive must be declared per content type */
const VALID_DIRECTIVES = [
  'index,follow',
  'index,nofollow',
  'noindex,follow',
  'noindex,nofollow',
];

export async function run({ dir }) {
  const specPath = join(dir, 'seo-metadata-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'SMS006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'SMS006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contentTypes) || spec.contentTypes.length === 0) {
    return { pass: true, code: 'SMS006', message: 'No contentTypes — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ct of spec.contentTypes) {
    if (!ct.robotsDirective) {
      violations.push(`"${ct.typeId}": robotsDirective not declared`);
      continue;
    }

    if (!VALID_DIRECTIVES.includes(ct.robotsDirective)) {
      violations.push(
        `"${ct.typeId}": robotsDirective "${ct.robotsDirective}" is not valid. ` +
        `Allowed: ${VALID_DIRECTIVES.join(' | ')}`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'SMS006',
      message: `${violations.length} content type(s) with invalid or missing robots directive`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'SMS006',
    message: `All ${spec.contentTypes.length} content type(s) have valid robots directives`,
  };
}
