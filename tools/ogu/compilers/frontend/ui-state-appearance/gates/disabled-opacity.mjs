import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * USA004 — disabled-opacity: disabled state uses opacity or a semantic disabled token.
 *
 * A disabled state communicated only through color change (e.g. gray text, no opacity)
 * can confuse users. Standard accessible disabled states use:
 * 1. opacity < 1 (most common — applies to the whole component)
 * 2. A semantic token containing "disabled" in its name
 * 3. disabledOpacityOk: true explicit override
 */

const DISABLED_TOKEN_PATTERN = /disabled|muted|dimmed/i;

export async function run({ dir }) {
  const specPath = join(dir, 'state-appearance-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USA004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USA004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const components = Array.isArray(spec.components) ? spec.components : [];
  if (components.length === 0) {
    return { pass: true, code: 'USA004', message: 'No components — gate skipped', skipped: true };
  }

  const violations = [];

  for (const comp of components) {
    const compId = comp.id || '(unnamed)';
    const disabledState = comp.states && comp.states.disabled;

    if (!disabledState || typeof disabledState !== 'object') {
      // No disabled state — states-complete gate catches this
      continue;
    }

    // Escape hatch
    if (disabledState.disabledOpacityOk === true) continue;

    // Check for opacity property
    const hasOpacity = disabledState.opacity !== undefined;
    if (hasOpacity) continue;

    // Check for cursor: not-allowed (acceptable indicator but not sufficient alone)
    // Check for disabled semantic token references in any value
    const hasDisabledToken = Object.values(disabledState).some(v => {
      return DISABLED_TOKEN_PATTERN.test(String(v || ''));
    });

    if (!hasDisabledToken) {
      violations.push(
        `"${compId}": disabled state uses neither opacity nor a disabled semantic token — consider opacity: 0.4 or {color.disabled.*} tokens`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USA004',
      message: `${violations.length} component(s) have insufficient disabled state communication`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USA004', message: `All ${components.length} component(s) use opacity or disabled tokens for disabled state` };
}
