import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TAX007 — prohibited-tags-declared: prohibited tag list must be explicitly declared (even if empty) */
export async function run({ dir }) {
  const specPath = join(dir, 'taxonomy-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'TAX007', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TAX007', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // prohibitedTags must be present as a key — even an empty array is valid
  if (!Object.prototype.hasOwnProperty.call(spec, 'prohibitedTags')) {
    return {
      pass: false,
      code: 'TAX007',
      message: 'prohibitedTags not declared in spec',
      detail: 'Must explicitly declare prohibitedTags (can be an empty array []). Absence means unknown policy.',
    };
  }

  if (!Array.isArray(spec.prohibitedTags)) {
    return {
      pass: false,
      code: 'TAX007',
      message: `prohibitedTags must be an array, got: ${typeof spec.prohibitedTags}`,
    };
  }

  return {
    pass: true,
    code: 'TAX007',
    message: `prohibitedTags declared (${spec.prohibitedTags.length} prohibited tag(s))`,
  };
}
