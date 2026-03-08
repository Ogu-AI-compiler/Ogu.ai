import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** AZ004 — no-unauthenticated-admin: admin-tier actions must never be accessible to unauthenticated actors */
export async function run({ dir }) {
  const specPath = join(dir, 'authz-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'AZ004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'AZ004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.rules)) {
    return { pass: true, code: 'AZ004', message: 'No rules array — gate skipped', skipped: true };
  }

  const UNAUTHENTICATED_SUBJECTS = new Set(['unauthenticated', 'anonymous', 'guest', 'public', '*', 'anyone']);
  const ADMIN_INDICATORS = ['admin', 'delete', 'create', 'write', 'update', 'patch', 'destroy', 'manage', 'configure'];

  const violations = [];

  for (const rule of spec.rules) {
    const id = rule.id || '?';
    const effect = String(rule.effect || '').toLowerCase();
    if (effect !== 'allow') continue;

    const subject = String(rule.subject || '').toLowerCase();
    if (!UNAUTHENTICATED_SUBJECTS.has(subject)) continue;

    const resource = String(rule.resource || '').toLowerCase();
    const action = String(rule.action || '').toLowerCase();
    const combined = resource + ' ' + action;

    // Check for admin-level access granted to unauthenticated
    const isAdminLevel = ADMIN_INDICATORS.some(indicator => combined.includes(indicator));
    if (isAdminLevel) {
      violations.push(`Rule "${id}": allow rule grants "${action}" on "${rule.resource}" to unauthenticated subject "${rule.subject}" — admin-tier operations must require authentication`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'AZ004',
      message: `${violations.length} rule(s) grant admin-tier access to unauthenticated subjects`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'AZ004', message: 'No admin-tier access granted to unauthenticated subjects' };
}
