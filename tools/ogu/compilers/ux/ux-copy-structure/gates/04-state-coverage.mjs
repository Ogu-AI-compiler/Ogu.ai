/**
 * Gate UCS004 — state-coverage
 * For each slot, every state in `stateCoverage` array must have:
 * - state (string matching: loading | success | empty | error)
 * - content (string) OR inherit (boolean)
 * A state with neither content nor inherit is a violation.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_STATES = new Set(['loading', 'success', 'empty', 'error']);

export async function run({ dir }) {
  const specPath = join(dir, 'copy-structure-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UCS004',
      message: 'copy-structure-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UCS004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.content_slots) || spec.content_slots.length === 0) {
    return {
      pass: true,
      code: 'UCS004',
      message: 'No content_slots to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const slot of spec.content_slots) {
    // Skip slots with no stateCoverage
    if (!Array.isArray(slot.stateCoverage) || slot.stateCoverage.length === 0) continue;

    const slotLabel = `slot(id="${slot.id ?? 'unknown'}")`;

    slot.stateCoverage.forEach((stateEntry, i) => {
      const entryLabel = `${slotLabel}.stateCoverage[${i}]`;

      // state field must match valid values
      if (typeof stateEntry.state !== 'string' || !VALID_STATES.has(stateEntry.state)) {
        violations.push(
          `${entryLabel} state="${stateEntry.state}" is invalid — ` +
          `must be one of: ${[...VALID_STATES].join(', ')}`
        );
        return;
      }

      const hasContent =
        typeof stateEntry.content === 'string' && stateEntry.content.trim() !== '';
      const hasInherit = typeof stateEntry.inherit === 'boolean';

      if (!hasContent && !hasInherit) {
        violations.push(
          `${entryLabel}(state="${stateEntry.state}") has neither content (string) nor inherit (boolean) — ` +
          'a state entry must declare what to show'
        );
      }
    });
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCS004',
      message: `${violations.length} state coverage violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UCS004',
    message: 'state-coverage: all stateCoverage entries have valid state and content/inherit',
  };
}
