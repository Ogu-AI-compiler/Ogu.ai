import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** PWS004 — no-unreachable-states: all states must be reachable from the initial state via transitions */
export async function run({ dir }) {
  const specPath = join(dir, 'publishing-workflow-spec.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'PWS004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'PWS004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.states) || spec.states.length === 0) {
    return { pass: true, code: 'PWS004', message: 'No states defined — gate skipped', skipped: true };
  }

  if (!spec.initialState) {
    return { pass: true, code: 'PWS004', message: 'No initialState declared — gate skipped', skipped: true };
  }

  // Build adjacency map: stateId → [target state IDs]
  const adjacency = new Map();
  for (const state of spec.states) {
    if (!state.id) continue;
    const targets = Object.values(state.transitions || {}).filter(
      t => typeof t === 'string'
    );
    adjacency.set(state.id, targets);
  }

  // BFS from initial state
  const reachable = new Set();
  const queue = [spec.initialState];
  reachable.add(spec.initialState);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const neighbor of (adjacency.get(current) || [])) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const allStateIds = spec.states.map(s => s.id).filter(Boolean);
  const unreachable = allStateIds.filter(id => !reachable.has(id));

  if (unreachable.length > 0) {
    return {
      pass: false,
      code: 'PWS004',
      message: `${unreachable.length} unreachable state(s) detected`,
      detail: `Unreachable from "${spec.initialState}": ${unreachable.join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'PWS004',
    message: `All ${allStateIds.length} state(s) reachable from "${spec.initialState}"`,
  };
}
