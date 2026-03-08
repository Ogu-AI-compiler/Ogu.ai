import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CP001 — spec-valid: required fields */
export async function run({ dir }) {
  const specPath = join(dir, 'csp-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'CP001', message: 'No csp-policy.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'CP001', message: 'csp-policy.json is not valid JSON', detail: err.message }; }

  const violations = [];
  if (!spec.app || typeof spec.app !== 'string') violations.push('Missing field: app');
  if (!spec.directives || typeof spec.directives !== 'object' || Array.isArray(spec.directives)) violations.push('Missing field: directives (must be an object)');

  if (spec.directives) {
    if (!spec.directives['default-src']) violations.push('directives must include "default-src"');
  }

  if (violations.length > 0) return { pass: false, code: 'CP001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'CP001', message: 'Spec valid' };
}
