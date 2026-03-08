import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ST003 — error-severity-blocking: error-level findings must be CI-blocking */
export async function run({ dir }) {
  const specPath = join(dir, 'sast-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'ST003', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'ST003', message: 'Invalid JSON — gate skipped', skipped: true }; }

  const blocking = String(spec.blocking_severity || '').toLowerCase();
  const BLOCKING_VALUES = new Set(['error', 'critical', 'high', 'warning']);

  if (!BLOCKING_VALUES.has(blocking)) {
    return {
      pass: false,
      code: 'ST003',
      message: `blocking_severity "${spec.blocking_severity}" is not valid — must be one of: error, critical, high, warning`,
    };
  }

  // Verify that error/critical severity is blocking (not just warning or info)
  if (blocking === 'info' || blocking === 'note') {
    return {
      pass: false,
      code: 'ST003',
      message: `blocking_severity="${spec.blocking_severity}" is too permissive — CI should block on at least "warning" level findings`,
    };
  }

  return { pass: true, code: 'ST003', message: `SAST findings at severity "${spec.blocking_severity}" and above are CI-blocking` };
}
