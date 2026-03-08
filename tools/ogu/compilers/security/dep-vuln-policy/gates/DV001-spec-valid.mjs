import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** DV001 — spec-valid */
export async function run({ dir }) {
  const specPath = join(dir, 'dep-vuln-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'DV001', message: 'No dep-vuln-policy.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'DV001', message: 'dep-vuln-policy.json is not valid JSON', detail: err.message }; }

  const violations = [];
  if (!spec.project) violations.push('Missing field: project');
  if (!Array.isArray(spec.ecosystems) || spec.ecosystems.length === 0) violations.push('Missing field: ecosystems (non-empty array)');
  if (!spec.thresholds || typeof spec.thresholds !== 'object') violations.push('Missing field: thresholds (object)');

  if (spec.thresholds) {
    const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low'];
    for (const level of SEVERITY_LEVELS) {
      if (spec.thresholds[level] === undefined) violations.push(`thresholds.${level} is not declared`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'DV001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'DV001', message: 'Spec valid' };
}
