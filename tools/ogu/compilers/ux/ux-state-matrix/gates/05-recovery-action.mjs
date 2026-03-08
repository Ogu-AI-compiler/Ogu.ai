/**
 * Gate UXS005 — recovery-action
 * Every non-terminal error state must declare at least one recovery action.
 * Recovery actions include: retry, redirect, dismiss, contact-support, refresh.
 * An error state with no recovery action leaves the user with no path forward.
 *
 * Per-state evaluation: checked independently for each state object,
 * not globally across all states.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ERROR_TYPES = new Set(['error', 'offline', 'unauthorized', 'not-found', 'partial']);

function isErrorState(stateType) {
  return ERROR_TYPES.has(stateType);
}

function hasRecoveryAction(state) {
  // State is terminal if explicitly marked (e.g., a fatal crash with no recovery)
  if (state.terminal === true) return true;
  if (Array.isArray(state.recoveryActions) && state.recoveryActions.length > 0) return true;
  if (typeof state.recoveryAction === 'string' && state.recoveryAction.trim() !== '') return true;
  if (typeof state.retry === 'boolean' && state.retry === true) return true;
  if (typeof state.redirect === 'string' && state.redirect.trim() !== '') return true;
  return false;
}

export async function run({ dir }) {
  const specPath = join(dir, 'state-matrix-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UXS005', message: 'state-matrix-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UXS005', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.screens) || spec.screens.length === 0) {
    return { pass: true, code: 'UXS005', message: 'No screens to check — skipped', skipped: true };
  }

  const violations = [];

  for (const screen of spec.screens) {
    if (!Array.isArray(screen.states)) continue;
    for (const state of screen.states) {
      const stateType = typeof state === 'string' ? state : state.type;
      if (!isErrorState(stateType)) continue;
      // String-only states (no object) have no recovery action metadata
      if (typeof state === 'string') {
        violations.push(
          `Screen "${screen.id}" state "${stateType}" is a bare string — ` +
          `declare it as an object with recoveryActions or retry/redirect`
        );
        continue;
      }
      if (!hasRecoveryAction(state)) {
        violations.push(
          `Screen "${screen.id}" state "${stateType}" has no recovery action ` +
          `(add recoveryActions, retry: true, redirect, or set terminal: true for intentional dead-ends)`
        );
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UXS005',
      message: `${violations.length} error state(s) with no recovery action`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UXS005',
    message: 'recovery-action: all error states declare a recovery path',
  };
}
