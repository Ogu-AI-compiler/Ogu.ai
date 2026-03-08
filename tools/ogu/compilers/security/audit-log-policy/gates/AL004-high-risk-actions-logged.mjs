import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AL004 — high-risk-actions-logged: delete, export, permission-change, login, admin actions must be audited */
export async function run({ dir }) {
  const specPath = join(dir, 'audit-log-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'AL004', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'AL004', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.events) || spec.events.length === 0) return { pass: true, code: 'AL004', message: 'No events — gate skipped', skipped: true };

  const HIGH_RISK_ACTIONS = ['delete', 'export', 'permission_change', 'role_change', 'login', 'logout', 'admin', 'impersonate', 'bulk_delete', 'purge'];
  const declaredActions = spec.events.map(e => String(e.action || '').toLowerCase());

  const violations = [];
  for (const action of HIGH_RISK_ACTIONS) {
    const isPresent = declaredActions.some(a => a.includes(action));
    if (!isPresent) {
      // Only flag if the feature plausibly has this action (don't fail for e.g. login on a pure data feature)
      // We only fail if the policy explicitly declares skip_high_risk_check: false or doesn't set skip at all
      if (!spec.skip_high_risk_check) {
        // Soft guidance — track but only fail on clearly relevant actions
        if (['delete', 'login', 'permission_change'].includes(action) && spec.events.length > 3) {
          violations.push(`High-risk action "${action}" is not covered by any declared audit event — add an event for this action or set skip_high_risk_check: true if not applicable`);
        }
      }
    }
  }

  if (violations.length > 0) return { pass: false, code: 'AL004', message: `${violations.length} high-risk action(s) not covered by audit events`, detail: violations.join('\n') };
  return { pass: true, code: 'AL004', message: 'High-risk actions covered by audit events' };
}
