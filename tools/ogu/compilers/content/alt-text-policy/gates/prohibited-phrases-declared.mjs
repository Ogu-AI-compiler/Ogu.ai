import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ALT005 — prohibited-phrases-declared: prohibited alt text content list must exist and include common bad patterns */
const REQUIRED_PROHIBITED_PATTERNS = ['image of', 'photo of', 'picture of'];

export async function run({ dir }) {
  const specPath = join(dir, 'alt-text-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'ALT005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'ALT005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Object.prototype.hasOwnProperty.call(spec, 'prohibitedPhrases')) {
    return {
      pass: false,
      code: 'ALT005',
      message: 'spec.prohibitedPhrases not declared',
      detail: 'Must declare prohibited phrases list including at minimum: "image of", "photo of", "picture of"',
    };
  }

  if (!Array.isArray(spec.prohibitedPhrases)) {
    return {
      pass: false,
      code: 'ALT005',
      message: `spec.prohibitedPhrases must be an array, got ${typeof spec.prohibitedPhrases}`,
    };
  }

  const normalizedList = spec.prohibitedPhrases.map(p => p.toLowerCase().trim());
  const missing = REQUIRED_PROHIBITED_PATTERNS.filter(
    pattern => !normalizedList.some(p => p.includes(pattern))
  );

  if (missing.length > 0) {
    return {
      pass: false,
      code: 'ALT005',
      message: `prohibitedPhrases missing required patterns: ${missing.join(', ')}`,
      detail: 'These are the most common useless alt text patterns that screen readers must not encounter.',
    };
  }

  return {
    pass: true,
    code: 'ALT005',
    message: `prohibitedPhrases declared with ${spec.prohibitedPhrases.length} pattern(s) including required defaults`,
  };
}
