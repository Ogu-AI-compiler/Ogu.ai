import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AL005 — retention-defined: audit log retention period must be declared */
export async function run({ dir }) {
  const specPath = join(dir, 'audit-log-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'AL005', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'AL005', message: 'Invalid JSON — gate skipped', skipped: true }; }

  const retention = spec.retention_days;
  if (retention === undefined || retention === null) {
    return { pass: false, code: 'AL005', message: 'retention_days is not declared — audit logs must have a defined retention period (e.g. 365 or 730 days)' };
  }
  if (typeof retention !== 'number' || retention <= 0) {
    return { pass: false, code: 'AL005', message: `retention_days must be a positive number, got: ${JSON.stringify(retention)}` };
  }
  if (retention < 90) {
    return { pass: false, code: 'AL005', message: `retention_days=${retention} is below minimum of 90 days for audit logs` };
  }

  return { pass: true, code: 'AL005', message: `Audit log retention: ${retention} days` };
}
