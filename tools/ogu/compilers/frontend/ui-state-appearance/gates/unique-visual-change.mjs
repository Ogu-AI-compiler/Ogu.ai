import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * USA005 — unique-visual-change: every state has at least one property that differs
 * from the default state.
 *
 * A state that is visually identical to default is not perceivable and violates
 * the core invariant: every functional state (UX) must have a unique, perceivable visual change (UI).
 */
export async function run({ dir }) {
  const specPath = join(dir, 'state-appearance-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USA005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USA005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  const components = Array.isArray(spec.components) ? spec.components : [];
  if (components.length === 0) {
    return { pass: true, code: 'USA005', message: 'No components — gate skipped', skipped: true };
  }

  const violations = [];

  for (const comp of components) {
    const compId = comp.id || '(unnamed)';
    const states = comp.states && typeof comp.states === 'object' ? comp.states : {};
    const defaultState = states.default;

    if (!defaultState || typeof defaultState !== 'object') {
      // No default state — states-complete will catch this
      continue;
    }

    for (const [stateName, stateProps] of Object.entries(states)) {
      if (stateName === 'default') continue;
      if (!stateProps || typeof stateProps !== 'object') continue;

      // States that are explicitly annotated as visually identical to default are exempt
      if (stateProps.identicalToDefault === true) continue;

      // Check: does this state have at least one property with a value different from default?
      const stateKeys = Object.keys(stateProps);
      if (stateKeys.length === 0) {
        violations.push(`"${compId}".${stateName}: empty state — no visual properties declared`);
        continue;
      }

      // Check if all properties in this state are identical to the default state
      const defaultKeys = Object.keys(defaultState);
      const hasAtLeastOneChange = stateKeys.some(key => {
        // A property that doesn't exist in default is already a change
        if (!(key in defaultState)) return true;
        // If it exists in both, compare values
        return JSON.stringify(defaultState[key]) !== JSON.stringify(stateProps[key]);
      });

      if (!hasAtLeastOneChange && defaultKeys.length === stateKeys.length) {
        violations.push(
          `"${compId}".${stateName}: state properties are identical to default — every state must have at least one perceivable visual difference`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USA005',
      message: `${violations.length} state(s) have no visual difference from default`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USA005', message: `All non-default states have perceivable visual changes` };
}
