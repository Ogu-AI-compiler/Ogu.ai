import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ALT006 — cms-field-referenced: every image context must declare a cmsField reference */
export async function run({ dir }) {
  const specPath = join(dir, 'alt-text-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'ALT006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'ALT006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.contexts) || spec.contexts.length === 0) {
    return { pass: true, code: 'ALT006', message: 'No contexts defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const ctx of spec.contexts) {
    if (!ctx.cmsField || typeof ctx.cmsField !== 'string' || ctx.cmsField.trim() === '') {
      violations.push(
        `Context "${ctx.name}": missing cmsField reference ` +
        `(which CMS field stores the alt text for this context?)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'ALT006',
      message: `${violations.length} context(s) missing cmsField reference`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'ALT006',
    message: `All ${spec.contexts.length} context(s) have cmsField references`,
  };
}
