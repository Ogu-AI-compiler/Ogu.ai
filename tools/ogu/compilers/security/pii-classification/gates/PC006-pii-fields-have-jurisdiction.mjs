import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PC006 — pii-fields-have-jurisdiction: fields marked as PII must declare applicable jurisdiction(s) */
export async function run({ dir }) {
  const specPath = join(dir, 'pii-classification.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'PC006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PC006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields)) {
    return { pass: true, code: 'PC006', message: 'No fields array — gate skipped', skipped: true };
  }

  const piiFields = spec.fields.filter(f => f.is_pii === true);
  if (piiFields.length === 0) {
    return { pass: true, code: 'PC006', message: 'No fields marked as is_pii — gate skipped', skipped: true };
  }

  const KNOWN_JURISDICTIONS = new Set(['gdpr', 'ccpa', 'hipaa', 'pipeda', 'lgpd', 'pdpa', 'global']);
  const violations = [];

  for (const field of piiFields) {
    const id = field.id || `${field.entity}.${field.field_name}` || '?';

    if (!Array.isArray(field.jurisdictions) || field.jurisdictions.length === 0) {
      violations.push(`Field "${id}" (is_pii=true): jurisdictions must be a non-empty array (e.g. ["gdpr", "ccpa"])`);
      continue;
    }

    for (const j of field.jurisdictions) {
      if (!KNOWN_JURISDICTIONS.has(String(j).toLowerCase())) {
        violations.push(`Field "${id}": unknown jurisdiction "${j}" — valid values: ${[...KNOWN_JURISDICTIONS].join(', ')}`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PC006',
      message: `${violations.length} PII field(s) missing valid jurisdiction declaration`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'PC006', message: `Jurisdiction declared for all ${piiFields.length} PII field(s)` };
}
