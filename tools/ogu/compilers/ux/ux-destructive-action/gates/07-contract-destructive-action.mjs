/**
 * Gate UDA007 — contract-destructive-action
 * Final contract check:
 * - version declared
 * - unique action ids
 * - at least one action declared
 * - no action with reversible:true has undoWindow > 300 (5 minutes max)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MAX_UNDO_WINDOW_SECONDS = 300;

export async function run({ dir }) {
  const specPath = join(dir, 'destructive-action-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDA007',
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
      code: 'UDA007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.actions)) {
    return {
      pass: true,
      code: 'UDA007',
      message: 'No actions array — skipped',
      skipped: true,
    };
  }

  const violations = [];

  // Rule: version declared
  if (!spec.version) {
    violations.push('Contract: destructive-action-spec.json missing field "version"');
  }

  // Rule: at least one action
  if (spec.actions.length === 0) {
    violations.push('Contract: actions array is empty — at least one action is required');
  }

  // Rule: unique action ids
  const seenIds = new Map();
  for (const action of spec.actions) {
    if (typeof action.id !== 'string') continue;
    if (seenIds.has(action.id)) {
      violations.push(`Contract: Duplicate action id "${action.id}"`);
    } else {
      seenIds.set(action.id, true);
    }
  }

  // Rule: undoWindow <= 300 for reversible actions
  for (const action of spec.actions) {
    if (action.reversible !== true) continue;
    if (typeof action.undoWindow !== 'number') continue;

    if (action.undoWindow > MAX_UNDO_WINDOW_SECONDS) {
      violations.push(
        `Contract: action(id="${action.id ?? 'unknown'}") undoWindow=${action.undoWindow}s ` +
        `exceeds maximum of ${MAX_UNDO_WINDOW_SECONDS}s (5 minutes)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDA007',
      message: `${violations.length} contract violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDA007',
    message: 'contract-destructive-action: all contract rules satisfied',
  };
}
