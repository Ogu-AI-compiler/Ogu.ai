import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AL001 — spec-valid */
export async function run({ dir }) {
  const specPath = join(dir, 'audit-log-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'AL001', message: 'No audit-log-policy.json — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (err) { return { pass: false, code: 'AL001', message: 'audit-log-policy.json is not valid JSON', detail: err.message }; }

  const violations = [];
  if (!spec.feature || typeof spec.feature !== 'string') violations.push('Missing field: feature');
  if (!Array.isArray(spec.events) || spec.events.length === 0) violations.push('Missing field: events (non-empty array)');
  if (!spec.schema || typeof spec.schema !== 'object') violations.push('Missing field: schema (required fields for every log entry)');

  if (Array.isArray(spec.events)) {
    spec.events.forEach((ev, i) => {
      if (!ev.action) violations.push(`events[${i}]: missing field "action"`);
      if (!ev.sensitivity) violations.push(`events[${i}]: missing field "sensitivity"`);
    });
  }

  if (violations.length > 0) return { pass: false, code: 'AL001', message: `Spec validation failed: ${violations.length} violation(s)`, detail: violations.join('\n') };
  return { pass: true, code: 'AL001', message: `Spec valid — ${spec.events.length} audit event(s) declared` };
}
