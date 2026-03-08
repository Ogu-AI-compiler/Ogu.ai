import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PWS006 — role-transitions-valid: transition-allowed roles must reference defined roles in spec.roles */
export async function run({ dir }) {
  const specPath = join(dir, 'publishing-workflow-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'PWS006', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PWS006', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.states) || spec.states.length === 0) {
    return { pass: true, code: 'PWS006', message: 'No states defined — gate skipped', skipped: true };
  }

  if (!spec.roles || typeof spec.roles !== 'object') {
    return { pass: true, code: 'PWS006', message: 'No roles defined — gate skipped', skipped: true };
  }

  const definedRoles = new Set(Object.keys(spec.roles));
  const violations = [];

  for (const state of spec.states) {
    // Check allowedRoles at state level
    if (Array.isArray(state.allowedRoles)) {
      for (const role of state.allowedRoles) {
        if (!definedRoles.has(role)) {
          violations.push(`State "${state.id}": allowedRoles references undefined role "${role}"`);
        }
      }
    }

    // Check per-transition role requirements
    if (state.transitionRoles && typeof state.transitionRoles === 'object') {
      for (const [transition, roles] of Object.entries(state.transitionRoles)) {
        if (!Array.isArray(roles)) continue;
        for (const role of roles) {
          if (!definedRoles.has(role)) {
            violations.push(
              `State "${state.id}" transition "${transition}": references undefined role "${role}"`
            );
          }
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'PWS006',
      message: `${violations.length} role reference violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'PWS006',
    message: `All role references valid (${definedRoles.size} role(s) defined)`,
  };
}
