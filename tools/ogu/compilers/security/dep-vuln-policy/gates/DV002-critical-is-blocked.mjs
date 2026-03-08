import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** DV002 — critical-is-blocked: critical severity vulnerabilities must have action: block */
export async function run({ dir }) {
  const specPath = join(dir, 'dep-vuln-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'DV002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'DV002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.thresholds) return { pass: true, code: 'DV002', message: 'No thresholds — gate skipped', skipped: true };

  const criticalAction = String(spec.thresholds.critical?.action || spec.thresholds.critical || '').toLowerCase();
  if (criticalAction !== 'block' && criticalAction !== 'fail' && criticalAction !== 'error') {
    return {
      pass: false,
      code: 'DV002',
      message: `thresholds.critical action is "${criticalAction}" — critical vulnerabilities must use action: "block" to prevent deployment`,
    };
  }
  return { pass: true, code: 'DV002', message: 'Critical vulnerabilities are set to block' };
}
