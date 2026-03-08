import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TAX005 — tag-counts-numeric: min/max tag counts must be numbers and min must be <= max */
export async function run({ dir }) {
  const specPath = join(dir, 'taxonomy-policy.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'TAX005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TAX005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!spec.contentTypes || typeof spec.contentTypes !== 'object') {
    return { pass: true, code: 'TAX005', message: 'No contentTypes defined — gate skipped', skipped: true };
  }

  const violations = [];

  for (const [typeId, rules] of Object.entries(spec.contentTypes)) {
    if (!rules || typeof rules !== 'object') continue;

    const min = rules.minTags;
    const max = rules.maxTags;

    if (min !== undefined && typeof min !== 'number') {
      violations.push(`"${typeId}": minTags must be a number, got ${typeof min} "${min}"`);
    }
    if (max !== undefined && typeof max !== 'number') {
      violations.push(`"${typeId}": maxTags must be a number, got ${typeof max} "${max}"`);
    }
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      violations.push(`"${typeId}": minTags (${min}) is greater than maxTags (${max})`);
    }
    if (typeof min === 'number' && min < 0) {
      violations.push(`"${typeId}": minTags (${min}) cannot be negative`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TAX005',
      message: `${violations.length} tag count validation error(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'TAX005',
    message: 'All tag count min/max values are valid numbers',
  };
}
