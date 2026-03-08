/**
 * Gate UXS006 — no-duplicate-states
 * Within a single screen, each state type must appear at most once.
 * Having two "error" states on the same screen creates ambiguity about
 * which one applies and which recovery action to show.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXS006', message: 'state-matrix-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXS006', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
    return { pass: true, code: 'UXS006', message: 'No screens to check — skipped', skipped: true };
  }

  const violations = [];

  for (const screen of spec.screens) {
    if (!Array.isArray(screen.states) || screen.states.length === 0) continue;

    const seen = new Map();
    for (const state of screen.states) {
      const stateType = typeof state === 'string' ? state : state.type;
      if (typeof stateType !== 'string') continue;
      if (seen.has(stateType)) {
        violations.push(`Screen "${screen.id}" has duplicate state type: "${stateType}"`);
      } else {
        seen.set(stateType, true);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS006',
      message: `${violations.length} duplicate state type(s) detected`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS006',
    message: 'no-duplicate-states: all screens have unique state types',
  };
}
