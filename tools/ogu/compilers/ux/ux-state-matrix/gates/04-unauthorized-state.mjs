/**
 * Gate UXS004 — unauthorized-state
 * Auth-protected screens (auth: true or visibility != "public") must declare
 * an "unauthorized" state — the UI behavior when a user without permission lands on the screen.
 * This is distinct from the navigation guard (which redirects before the screen loads);
 * the unauthorized state handles cases where auth expires mid-session.
 * Escape hatch: screen.unauthorizedHandledByGuard = true.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function isProtected(screen) {
  if (screen.auth === true) return true;
  if (typeof screen.visibility === 'string' && screen.visibility !== 'public') return true;
  return false;
}

function hasUnauthorizedState(screen) {
  if (!Array.isArray(screen.states)) return false;
  return screen.states.some(s => {
    const type = typeof s === 'string' ? s : s.type;
    return type === 'unauthorized';
  });
}

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXS004', message: 'state-matrix-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXS004', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
    return { pass: true, code: 'UXS004', message: 'No screens to check — skipped', skipped: true };
  }

  const violations = [];

  for (const screen of spec.screens) {
    if (!isProtected(screen)) continue;
    if (screen.unauthorizedHandledByGuard === true) continue;
    if (!hasUnauthorizedState(screen)) {
      violations.push(
        `Screen "${screen.id}" is auth-protected but has no "unauthorized" state ` +
        `(or set unauthorizedHandledByGuard: true if the route guard handles this entirely)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS004',
      message: `${violations.length} protected screen(s) missing unauthorized state`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS004',
    message: 'unauthorized-state: all protected screens declare unauthorized handling',
  };
}
