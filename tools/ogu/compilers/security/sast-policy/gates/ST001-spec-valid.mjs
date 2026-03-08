import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ST001 — spec-valid */
export async function run({ dir }) {
  const specPath = join(dir, 'sast-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'ST001', message: 'No sast-policy.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'ST001', message: 'sast-policy.json is not valid JSON', detail: err.message }; }

  const violations = [];
  if (!spec.project) violations.push('Missing field: project');
  if (!Array.isArray(spec.languages) || spec.languages.length === 0) violations.push('Missing field: languages (non-empty array)');
  if (!Array.isArray(spec.rule_sets) || spec.rule_sets.length === 0) violations.push('Missing field: rule_sets (non-empty array)');
  if (!spec.blocking_severity) violations.push('Missing field: blocking_severity');

  if (violations.length > 0) return { pass: false, code: 'ST001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'ST001', message: 'Spec valid' };
}
