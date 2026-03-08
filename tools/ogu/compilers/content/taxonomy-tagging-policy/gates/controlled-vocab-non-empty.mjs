import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TAX003 — controlled-vocab-non-empty: if vocabularyType is "controlled", tag list must be non-empty with unique IDs */
export async function run({ dir }) {
  const specPath = join(dir, 'taxonomy-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'TAX003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TAX003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  // Only applies to controlled vocabulary
  if (spec.vocabularyType !== 'controlled') {
    return {
      pass: true,
      code: 'TAX003',
      message: `vocabularyType is "${spec.vocabularyType}" — controlled vocab check skipped`,
      skipped: true,
    };
  }

  if (!Array.isArray(spec.vocabulary) || spec.vocabulary.length === 0) {
    return {
      pass: false,
      code: 'TAX003',
      message: 'vocabularyType is "controlled" but vocabulary array is empty or missing',
      detail: 'A controlled vocabulary requires a non-empty tag list in spec.vocabulary',
    };
  }

  const violations = [];
  const seenIds = new Set();

  for (const tag of spec.vocabulary) {
    if (!tag.id) {
      violations.push(`Tag missing id: ${JSON.stringify(tag).slice(0, 60)}`);
      continue;
    }
    if (seenIds.has(tag.id)) {
      violations.push(`Duplicate tag id: "${tag.id}"`);
    } else {
      seenIds.add(tag.id);
    }
    if (!tag.label) {
      violations.push(`Tag "${tag.id}" missing label`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TAX003',
      message: `${violations.length} vocabulary violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'TAX003',
    message: `Controlled vocabulary has ${spec.vocabulary.length} valid tag(s)`,
  };
}
