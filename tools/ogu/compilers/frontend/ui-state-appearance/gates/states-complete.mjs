import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * USA002 — states-complete: all 6 required states defined for every component.
 *
 * Required states: default, hover, focus, active, disabled, error
 *
 * Components can opt out of specific states by declaring:
 *   "statesNotApplicable": ["active"]
 * (e.g. a static label has no hover/active states)
 */

const REQUIRED_STATES = ['default', 'hover', 'focus', 'active', 'disabled', 'error'];

export async function run({ dir }) {
  const specPath = join(dir, 'state-appearance-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USA002', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USA002', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const components = Array.isArray(spec.components) ? spec.components : [];
  if (components.length === 0) {
    return { pass: true, code: 'USA002', message: 'No components — gate skipped', skipped: true };
  }

  const violations = [];

  for (const comp of components) {
    const compId = comp.id || '(unnamed)';
    const states = comp.states && typeof comp.states === 'object' ? comp.states : {};
    const notApplicable = new Set(Array.isArray(comp.statesNotApplicable) ? comp.statesNotApplicable : []);

    const missingStates = REQUIRED_STATES.filter(
      state => !notApplicable.has(state) && !states[state]
    );

    if (missingStates.length > 0) {
      violations.push(`"${compId}": missing states: ${missingStates.join(', ')}`);
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USA002',
      message: `${violations.length} component(s) missing required states`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USA002',
    message: `All ${components.length} component(s) have the 6 required states`,
  };
}
