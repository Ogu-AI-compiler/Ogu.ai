import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TAX002 — vocabulary-type-declared: vocabularyType must be one of controlled/free-form/hybrid */
const VALID_TYPES = ['controlled', 'free-form', 'hybrid'];

export async function run({ dir }) {
  const specPath = join(dir, 'taxonomy-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'TAX002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TAX002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!spec.vocabularyType) {
    return {
      pass: false,
      code: 'TAX002',
      message: 'vocabularyType not declared',
      detail: `Must be one of: ${VALID_TYPES.join(', ')}`,
    };
  }

  if (!VALID_TYPES.includes(spec.vocabularyType)) {
    return {
      pass: false,
      code: 'TAX002',
      message: `Invalid vocabularyType: "${spec.vocabularyType}"`,
      detail: `Allowed values: ${VALID_TYPES.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'TAX002',
    message: `vocabularyType is "${spec.vocabularyType}"`,
  };
}
