import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PC004 — sensitive-logging-restricted: sensitive and highly_sensitive fields must restrict logging */
export async function run({ dir }) {
  const specPath = join(dir, 'pii-classification.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'PC004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PC004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields)) {
    return { pass: true, code: 'PC004', message: 'No fields array — gate skipped', skipped: true };
  }

  const RESTRICTED_LEVELS = new Set(['sensitive', 'highly_sensitive']);
  const restrictedFields = spec.fields.filter(f => RESTRICTED_LEVELS.has(f.classification_level));

  if (restrictedFields.length === 0) {
    return { pass: true, code: 'PC004', message: 'No sensitive/highly_sensitive fields — gate skipped', skipped: true };
  }

  const violations = [];

  for (const field of restrictedFields) {
    const id = field.id || `${field.entity}.${field.field_name}` || '?';
    const level = field.classification_level;

    if (field.log_in_plaintext === true) {
      violations.push(`Field "${id}" (${level}): log_in_plaintext must not be true — sensitive data must be masked or excluded from logs`);
    }

    if (!field.log_handling || typeof field.log_handling !== 'string') {
      violations.push(`Field "${id}" (${level}): log_handling must be declared (e.g. "mask", "exclude", "hash")`);
    } else {
      const validHandling = new Set(['mask', 'exclude', 'hash', 'truncate', 'redact']);
      if (!validHandling.has(field.log_handling)) {
        violations.push(`Field "${id}" (${level}): log_handling "${field.log_handling}" is not valid — must be one of: ${[...validHandling].join(', ')}`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PC004',
      message: `${violations.length} sensitive field(s) missing or invalid logging restriction`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'PC004', message: `Logging restricted for all ${restrictedFields.length} sensitive/highly_sensitive field(s)` };
}
