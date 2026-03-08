import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TAX004 — per-type-tag-rules: every content type that supports tagging has min/max count rules */
export async function run({ dir }) {
  const specPath = join(dir, 'taxonomy-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'TAX004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TAX004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!spec.contentTypes || typeof spec.contentTypes !== 'object') {
    return { pass: true, code: 'TAX004', message: 'No contentTypes defined — gate skipped', skipped: true };
  }

  const typeEntries = Object.entries(spec.contentTypes);
  if (typeEntries.length === 0) {
    return { pass: true, code: 'TAX004', message: 'contentTypes is empty — gate skipped', skipped: true };
  }

  const violations = [];

  for (const [typeId, rules] of typeEntries) {
    if (!rules || typeof rules !== 'object') {
      violations.push(`Content type "${typeId}": tag rules must be an object`);
      continue;
    }

    if (rules.minTags === undefined) {
      violations.push(`Content type "${typeId}": missing minTags`);
    }
    if (rules.maxTags === undefined) {
      violations.push(`Content type "${typeId}": missing maxTags`);
    }

    // Check allowed vocabularies reference declared vocab type
    if (rules.allowedVocabularies !== undefined && !Array.isArray(rules.allowedVocabularies)) {
      violations.push(`Content type "${typeId}": allowedVocabularies must be an array`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TAX004',
      message: `${violations.length} content type(s) missing tag count rules`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'TAX004',
    message: `All ${typeEntries.length} content type(s) have tag count rules`,
  };
}
