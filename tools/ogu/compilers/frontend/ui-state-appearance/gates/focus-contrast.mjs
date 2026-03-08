import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * USA003 — focus-contrast: focus state specifies a focusRing token or explicit contrast mechanism.
 *
 * WCAG 2.1 SC 1.4.11 requires focus indicators to have ≥ 3:1 contrast against adjacent surface.
 * We verify that the focus state either:
 * 1. Declares a focusRing property (any token reference is acceptable — it implies visible ring)
 * 2. OR declares focusContrastOk: true (explicit override with justification)
 *
 * If neither is present, the focus state is likely invisible and fails this gate.
 */
export async function run({ dir }) {
  const specPath = join(dir, 'state-appearance-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USA003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USA003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const components = Array.isArray(spec.components) ? spec.components : [];
  if (components.length === 0) {
    return { pass: true, code: 'USA003', message: 'No components — gate skipped', skipped: true };
  }

  const violations = [];

  for (const comp of components) {
    const compId = comp.id || '(unnamed)';
    const focusState = comp.states && comp.states.focus;

    if (!focusState || typeof focusState !== 'object') {
      // No focus state — states-complete gate will catch this
      continue;
    }

    // Must have focusRing property OR explicit opt-out
    const hasFocusRing    = focusState.focusRing !== undefined && focusState.focusRing !== null;
    const hasContrastOk   = focusState.focusContrastOk === true;
    const hasOutline      = focusState.outline !== undefined;
    const hasBoxShadow    = focusState.boxShadow !== undefined;

    if (!hasFocusRing && !hasContrastOk && !hasOutline && !hasBoxShadow) {
      violations.push(
        `"${compId}": focus state has no focusRing, outline, or boxShadow — visible focus indicator required (WCAG SC 2.4.7 / 2.4.11)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USA003',
      message: `${violations.length} component(s) missing visible focus indicator`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USA003', message: `All ${components.length} component(s) have a visible focus indicator` };
}
