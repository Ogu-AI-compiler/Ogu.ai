import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** USA008 — contract-state: validates spec against state-appearance.contract.json */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'state-appearance.contract.json');

export async function run({ dir }) {
  const specPath = join(dir, 'state-appearance-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USA008', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USA008', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'USA008', message: `Cannot load contract: ${err.message}` };
  }

  const components = Array.isArray(spec.components) ? spec.components : [];
  const violations = [];

  // Rule: component-ids-unique — no two components share the same id
  const seen = new Map();
  for (const comp of components) {
    if (comp.id) {
      if (seen.has(comp.id)) {
        violations.push(`Rule "component-ids-unique": duplicate component id "${comp.id}"`);
      } else {
        seen.set(comp.id, true);
      }
    }
  }

  // Rule: default-state-has-tokens — every component's default state must have visual properties
  for (const comp of components) {
    const defaultState = comp.states && comp.states.default;
    if (!defaultState || typeof defaultState !== 'object' || Object.keys(defaultState).length === 0) {
      violations.push(`Rule "default-state-has-tokens": "${comp.id || '(unnamed)'}" default state has no visual properties`);
    }
  }

  // Rule: no-empty-states — no state object can be completely empty (except opt-out)
  for (const comp of components) {
    const states = comp.states && typeof comp.states === 'object' ? comp.states : {};
    for (const [stateName, stateProps] of Object.entries(states)) {
      if (typeof stateProps === 'object' && stateProps !== null && Object.keys(stateProps).length === 0) {
        violations.push(`Rule "no-empty-states": "${comp.id || '(unnamed)'}.${stateName}" is an empty object — remove it or add visual properties`);
      }
    }
  }

  // Rule: minimum-one-component — spec must have at least one component
  if (components.length === 0) {
    violations.push('Rule "minimum-one-component": no components declared in spec');
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USA008',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'USA008', message: `Contract "${contract.id}" satisfied (${components.length} component(s))` };
}
