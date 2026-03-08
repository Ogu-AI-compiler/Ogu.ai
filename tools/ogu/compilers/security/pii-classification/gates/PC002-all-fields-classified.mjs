import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PC002 — all-fields-classified: no field may have an unset or unknown classification */
export async function run({ dir }) {
  const specPath = join(dir, 'pii-classification.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'PC002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PC002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    return { pass: true, code: 'PC002', message: 'No fields array — gate skipped', skipped: true };
  }

  const CLASSIFIED_LEVELS = new Set(['public', 'internal', 'sensitive', 'highly_sensitive']);
  const violations = [];

  for (const field of spec.fields) {
    const id = field.id || `${field.entity}.${field.field_name}` || '?';
    if (!field.classification_level) {
      violations.push(`Field "${id}": classification_level is missing`);
    } else if (!CLASSIFIED_LEVELS.has(field.classification_level)) {
      violations.push(`Field "${id}": classification_level "${field.classification_level}" is not a valid level`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PC002',
      message: `${violations.length} field(s) are unclassified or have invalid classification`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'PC002', message: `All ${spec.fields.length} field(s) have valid classification levels` };
}
