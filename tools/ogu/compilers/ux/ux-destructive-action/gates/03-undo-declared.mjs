/**
 * Gate UDA003 — undo-declared
 * Every action with `reversible: true` must declare:
 * - undoWindow (number, seconds)
 * - undoTrigger (string)
 * Irreversible actions (reversible:false or absent) are exempt.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'destructive-action-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDA003',
      message: 'destructive-action-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UDA003',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.actions) || spec.actions.length === 0) {
    return {
      pass: true,
      code: 'UDA003',
      message: 'No actions to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const action of spec.actions) {
    // Gate only applies to reversible actions
    if (action.reversible !== true) continue;

    const label = `action(id="${action.id ?? 'unknown'}")`;

    const hasUndoWindow =
      typeof action.undoWindow === 'number' &&
      Number.isFinite(action.undoWindow) &&
      action.undoWindow > 0;

    const hasUndoTrigger =
      typeof action.undoTrigger === 'string' &&
      action.undoTrigger.trim() !== '';

    if (!hasUndoWindow) {
      violations.push(
        `${label} reversible:true but missing undoWindow (positive number in seconds)`
      );
    }

    if (!hasUndoTrigger) {
      violations.push(
        `${label} reversible:true but missing undoTrigger (string — how the user initiates undo)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDA003',
      message: `${violations.length} reversible action(s) missing undo declaration`,
      detail: violations.join('\n'),
    };
  }

  const reversibleCount = spec.actions.filter(a => a.reversible === true).length;
  return {
    pass: true,
    code: 'UDA003',
    message: `undo-declared: ${reversibleCount} reversible action(s) all have undoWindow and undoTrigger`,
  };
}
