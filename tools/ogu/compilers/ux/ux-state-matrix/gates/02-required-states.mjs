/**
 * Gate UXS002 — required-states
 * Every screen with at least one data dependency must declare all required states:
 *   - loading
 *   - success
 *   - empty
 *   - error
 * Screens with no dataDependencies (static screens) are skipped.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRED_STATES = ['loading', 'success', 'empty', 'error'];

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXS002', message: 'state-matrix-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXS002', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
    return { pass: true, code: 'UXS002', message: 'No screens to check — skipped', skipped: true };
  }

  const violations = [];

  for (const screen of spec.screens) {
    // Static screens (no data dependencies) don't need all states
    if (!Array.isArray(screen.dataDependencies) || screen.dataDependencies.length === 0) {
      continue;
    }

    const declaredStates = new Set(
      Array.isArray(screen.states) ? screen.states.map(s => s.type || s) : []
    );

    for (const required of REQUIRED_STATES) {
      if (!declaredStates.has(required)) {
        violations.push(
          `Screen "${screen.id}" has data dependencies but missing required state: "${required}"`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS002',
      message: `${violations.length} missing required state(s) across data-dependent screens`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS002',
    message: 'required-states: all data-dependent screens declare loading/success/empty/error',
  };
}
