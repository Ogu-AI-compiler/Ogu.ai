import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TAX001 — spec-valid: spec file exists, is valid JSON, and has required structure */
export async function run({ dir }) {
  const specPath = join(dir, 'taxonomy-policy.spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: false,
      code: 'TAX001',
      message: 'taxonomy-policy.spec.json not found',
      detail: `Expected file at: ${specPath}`,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'TAX001',
      message: 'taxonomy-policy.spec.json is not valid JSON',
      detail: err.message,
    };
  }

  const missing = [];
  if (!spec.vocabularyType) missing.push('vocabularyType');
  if (!spec.contentTypes || typeof spec.contentTypes !== 'object') missing.push('contentTypes');

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'TAX001',
      message: `Spec missing required fields: ${missing.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'TAX001',
    message: 'Spec structure valid',
  };
}
