import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** DV003 — high-has-sla: high severity must have a remediation SLA <= 14 days */
export async function run({ dir }) {
  const specPath = join(dir, 'dep-vuln-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'DV003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'DV003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!spec.thresholds) return { pass: true, code: 'DV003', message: 'No thresholds — gate skipped', skipped: true };

  const highThreshold = spec.thresholds.high;
  const highSla = typeof highThreshold === 'object' ? highThreshold.remediation_sla_days : spec.thresholds.high_sla_days;

  if (highSla === undefined || highSla === null) {
    return { pass: false, code: 'DV003', message: 'thresholds.high.remediation_sla_days is not declared — high vulnerabilities must have a remediation deadline' };
  }
  if (typeof highSla !== 'number' || highSla > 14) {
    return { pass: false, code: 'DV003', message: `thresholds.high.remediation_sla_days=${highSla} exceeds maximum of 14 days` };
  }

  return { pass: true, code: 'DV003', message: `High vulnerability SLA: ${highSla} days` };
}
