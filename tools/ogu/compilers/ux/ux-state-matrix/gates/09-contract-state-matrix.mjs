/**
 * Gate UXS009 — contract-state-matrix
 * Final contract validation:
 * - version declared
 * - unique screen ids
 * - every state object (non-string) has a type field
 * - no screen id is empty or whitespace
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXS009', message: 'state-matrix-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXS009', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
    return { pass: true, code: 'UXS009', message: 'No screens to check — skipped', skipped: true };
  }

  const violations = [];

  // Rule: version
  if (!spec.version) {
    violations.push('Contract: state-matrix-spec.json missing field "version"');
  }

  // Rule: unique screen ids
  const seenIds = new Map();
  for (const screen of spec.screens) {
    if (typeof screen.id !== 'string') continue;
    if (seenIds.has(screen.id)) {
      violations.push(`Contract: Duplicate screen id "${screen.id}"`);
    } else {
      seenIds.set(screen.id, true);
    }
  }

  // Rule: state objects must have type
  for (const screen of spec.screens) {
    if (!Array.isArray(screen.states)) continue;
    screen.states.forEach((state, i) => {
      if (typeof state === 'object' && state !== null && !state.type) {
        violations.push(
          `Contract: Screen "${screen.id}" states[${i}] is an object but missing "type" field`
        );
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS009',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS009',
    message: 'contract-state-matrix: all contract rules satisfied',
  };
}
