/**
 * Deterministic Mode — formal verification mode with full lockdown.
 *
 * When active:
 *   - Policies frozen — no rule changes
 *   - OrgSpec frozen — no role changes
 *   - Model routing pinned — no escalation
 *   - Overrides blocked — no human overrides
 *   - Budget limits frozen — no limit changes
 *   - Learning signals recorded but NOT applied
 *   - Auto-transitions disabled
 *
 * Company snapshots captured at entry and exit.
 * Any non-determinism halts task + escalates.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

function loadState(root) {
  const p = join(root, '.ogu/STATE.json');
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

function saveState(root, state) {
  writeFileSync(join(root, '.ogu/STATE.json'), JSON.stringify(state, null, 2));
}

// ── Enable ────────────────────────────────────────────────────────────

/**
 * Enable deterministic mode with full lockdown.
 */
export function enableDeterministic({ root, seed, actor } = {}) {
  root = root || repoRoot();
  const state = loadState(root);

  if (state.deterministicMode) {
    return { enabled: false, reason: 'Already in deterministic mode' };
  }

  // Capture entry snapshot reference
  const entrySnapshot = `deterministic-entry-${Date.now()}`;

  state.deterministicMode = true;
  state.deterministicEnabledAt = new Date().toISOString();
  state.deterministicActivatedBy = actor || 'system';
  if (seed !== undefined) state.deterministicSeed = seed;

  state.deterministicLocks = {
    policies: 'frozen',
    orgSpec: 'frozen',
    modelRouting: 'pinned',
    capabilityRegistry: 'frozen',
    overrides: 'blocked',
    budgetLimits: 'frozen',
  };

  state.deterministicBehavior = {
    escalation: 'disabled',
    autoTransitions: 'disabled',
    learningSignals: 'recorded_not_applied',
    orgEvolution: 'queued_not_executed',
    chaosTests: 'allowed',
  };

  state.deterministicEntrySnapshot = entrySnapshot;

  saveState(root, state);

  emitAudit('deterministic.enabled', {
    actor: actor || 'system',
    seed,
    entrySnapshot,
    locks: state.deterministicLocks,
  }, {});

  return {
    enabled: true,
    entrySnapshot,
    locks: state.deterministicLocks,
    behavior: state.deterministicBehavior,
  };
}

// ── Disable ───────────────────────────────────────────────────────────

/**
 * Disable deterministic mode and capture exit snapshot.
 */
export function disableDeterministic({ root, actor } = {}) {
  root = root || repoRoot();
  const state = loadState(root);

  if (!state.deterministicMode) {
    return { disabled: false, reason: 'Not in deterministic mode' };
  }

  const exitSnapshot = `deterministic-exit-${Date.now()}`;
  const entrySnapshot = state.deterministicEntrySnapshot;

  state.deterministicMode = false;
  state.deterministicDisabledAt = new Date().toISOString();
  state.deterministicExitSnapshot = exitSnapshot;
  delete state.deterministicLocks;
  delete state.deterministicBehavior;
  delete state.deterministicSeed;

  saveState(root, state);

  emitAudit('deterministic.disabled', {
    actor: actor || 'system',
    entrySnapshot,
    exitSnapshot,
  }, {});

  return { disabled: true, entrySnapshot, exitSnapshot };
}

// ── Query ─────────────────────────────────────────────────────────────

/**
 * Check if deterministic mode is active.
 */
export function isDeterministic({ root } = {}) {
  root = root || repoRoot();
  const state = loadState(root);
  return !!state.deterministicMode;
}

/**
 * Get full deterministic mode status.
 */
export function getDeterministicStatus({ root } = {}) {
  root = root || repoRoot();
  const state = loadState(root);

  if (!state.deterministicMode) {
    return {
      active: false,
      enabledAt: state.deterministicEnabledAt || null,
      disabledAt: state.deterministicDisabledAt || null,
    };
  }

  return {
    active: true,
    enabledAt: state.deterministicEnabledAt,
    activatedBy: state.deterministicActivatedBy || 'unknown',
    seed: state.deterministicSeed || null,
    locks: state.deterministicLocks || {},
    behavior: state.deterministicBehavior || {},
    entrySnapshot: state.deterministicEntrySnapshot || null,
  };
}

// ── Enforcement ───────────────────────────────────────────────────────

/**
 * Check if an operation is allowed in deterministic mode.
 */
export function checkDeterministicGuard({ root, operation } = {}) {
  root = root || repoRoot();

  if (!isDeterministic({ root })) {
    return { allowed: true, reason: 'Not in deterministic mode' };
  }

  const blockedOps = [
    'policy_change', 'orgspec_change', 'model_escalation',
    'override_create', 'budget_change', 'capability_change',
    'auto_transition', 'learning_apply', 'org_evolution_execute',
  ];

  if (blockedOps.includes(operation)) {
    return {
      allowed: false,
      reason: `Operation '${operation}' blocked in deterministic mode`,
    };
  }

  return { allowed: true };
}

/**
 * Enforce determinism by comparing execution hashes.
 */
export function enforceDeterminism({ root, executionHash, expectedHash } = {}) {
  root = root || repoRoot();

  if (!isDeterministic({ root })) {
    return { valid: true, reason: 'deterministic mode not active' };
  }

  if (executionHash === expectedHash) {
    return { valid: true };
  }

  emitAudit('deterministic.violation', {
    executionHash,
    expectedHash,
    action: 'halt_task',
  }, {});

  return {
    valid: false,
    reason: `Hash mismatch: expected ${expectedHash}, got ${executionHash}`,
    action: 'halt_task_and_escalate',
  };
}
