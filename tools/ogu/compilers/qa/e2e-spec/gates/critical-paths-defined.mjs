import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA021 — critical-paths-defined
 * At least one user flow must be marked criticalPath: true.
 *
 * Critical paths are the flows that run in the pre-deploy gate — the minimum
 * set of scenarios that must pass before any deployment. Without them, there
 * is no pre-deploy E2E gate and regression risk is unbounded.
 */

export async function run({ dir }) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(join(dir, 'e2e-spec.json'), 'utf8'));
  } catch {
    return { pass: false, code: 'QA021', message: 'e2e-spec.json not readable' };
  }

  const flows = spec.userFlows || [];
  const critical = flows.filter(f => f.criticalPath === true);

  if (critical.length === 0) {
    return {
      pass: false, code: 'QA021',
      message: 'No user flow marked criticalPath: true',
      detail: `Mark your most important flows (registration, checkout, login) with criticalPath: true.\nThese will be the pre-deploy gate.\n\nFlows: ${flows.map(f => f.id).join(', ')}`,
    };
  }

  return {
    pass: true, code: 'QA021',
    message: `${critical.length} critical path(s) defined: ${critical.map(f => f.id).join(', ')}`,
  };
}
