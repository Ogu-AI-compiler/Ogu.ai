import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TAX006 — normalization-rules: normalization rules must cover case, special characters, and whitespace */
export async function run({ dir }) {
  const specPath = join(dir, 'taxonomy-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'TAX006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TAX006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const norm = spec.normalization;

  if (!norm || typeof norm !== 'object') {
    return {
      pass: false,
      code: 'TAX006',
      message: 'normalization rules not defined',
      detail: 'spec.normalization must declare rules for: case, specialChars, whitespace',
    };
  }

  const missing = [];
  if (norm.case === undefined) missing.push('case');
  if (norm.specialChars === undefined) missing.push('specialChars');
  if (norm.whitespace === undefined) missing.push('whitespace');

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'TAX006',
      message: `normalization rules missing coverage for: ${missing.join(', ')}`,
      detail: 'Each must be explicitly declared (e.g., case: "lowercase", specialChars: "strip", whitespace: "trim-collapse")',
    };
  }

  // Validate case value
  const validCaseValues = ['lowercase', 'uppercase', 'preserve'];
  if (!validCaseValues.includes(norm.case)) {
    return {
      pass: false,
      code: 'TAX006',
      message: `normalization.case has invalid value: "${norm.case}"`,
      detail: `Allowed values: ${validCaseValues.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'TAX006',
    message: `Normalization rules cover case="${norm.case}", specialChars, whitespace`,
  };
}
