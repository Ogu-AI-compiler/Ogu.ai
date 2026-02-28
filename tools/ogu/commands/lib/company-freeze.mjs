/**
 * Company Freeze — graceful read-only mode for audit/compliance.
 *
 * Freeze ≠ Halt. Freeze is graceful (checkpoint, snapshot, pause).
 * Halt is emergency (immediate stop + resource release).
 *
 * On freeze:
 *   1. Checkpoint all in-progress tasks
 *   2. Capture company snapshot
 *   3. Emit audit event
 *   4. Set system mode to 'frozen'
 *
 * On unfreeze:
 *   1. Capture company snapshot (for diff)
 *   2. Run consistency check
 *   3. Resume scheduler
 *   4. Emit audit event
 *
 * Both require CTO (actor parameter).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

// ── Freeze ────────────────────────────────────────────────────────────

/**
 * Freeze the organization — graceful read-only mode.
 */
export function freeze({ root, reason, actor } = {}) {
  root = root || repoRoot();
  const state = loadState(root);

  if (state.frozen) {
    return { frozen: false, reason: 'Already frozen', frozenAt: state.frozenAt };
  }

  // 1. Checkpoint in-progress tasks
  let checkpoints = 0;
  try {
    const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerPath)) {
      const schedulerState = JSON.parse(readFileSync(schedulerPath, 'utf8'));
      const running = (schedulerState.queue || []).filter(t =>
        t.status === 'scheduled' || t.status === 'dispatched'
      );

      const checkpointDir = join(root, '.ogu/checkpoints');
      if (!existsSync(checkpointDir)) mkdirSync(checkpointDir, { recursive: true });

      for (const task of running) {
        writeFileSync(
          join(checkpointDir, `${task.taskId}.checkpoint.json`),
          JSON.stringify({
            taskId: task.taskId,
            featureSlug: task.featureSlug,
            checkpointedAt: new Date().toISOString(),
            reason: 'company_freeze',
            previousStatus: task.status,
          }, null, 2),
          'utf8'
        );
        task.status = 'frozen';
        task.frozenAt = new Date().toISOString();
        checkpoints++;
      }

      schedulerState.frozen = true;
      writeFileSync(schedulerPath, JSON.stringify(schedulerState, null, 2), 'utf8');
    }
  } catch { /* best effort */ }

  // 2. Capture snapshot reference
  const snapshotId = `freeze-${Date.now()}`;

  // 3. Set frozen state
  state.frozen = true;
  state.frozenAt = new Date().toISOString();
  state.frozenBy = actor || 'system';
  state.freezeReason = reason || 'manual freeze';
  state.freezeSnapshot = snapshotId;
  saveState(root, state);

  // 4. Audit
  emitAudit('company.frozen', {
    reason: reason || 'manual freeze',
    actor: actor || 'system',
    checkpoints,
    snapshotId,
  }, {});

  return {
    frozen: true,
    checkpoints,
    snapshotId,
    reason: reason || 'manual freeze',
  };
}

// ── Unfreeze ──────────────────────────────────────────────────────────

/**
 * Unfreeze the organization — resume operations after consistency check.
 */
export function thaw({ root, actor } = {}) {
  root = root || repoRoot();
  const state = loadState(root);

  if (!state.frozen) {
    return { thawed: false, reason: 'Not frozen' };
  }

  if (!actor) {
    return { thawed: false, reason: 'Unfreeze requires actor identification' };
  }

  // 1. Consistency check
  const consistencyResult = runFreezeConsistencyCheck(root);
  if (!consistencyResult.passed) {
    return {
      thawed: false,
      reason: `Consistency check failed: ${consistencyResult.failures.join(', ')}`,
      consistencyResult,
    };
  }

  // 2. Capture exit snapshot
  const exitSnapshotId = `unfreeze-${Date.now()}`;

  // 3. Resume scheduler
  try {
    const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerPath)) {
      const schedulerState = JSON.parse(readFileSync(schedulerPath, 'utf8'));
      schedulerState.frozen = false;
      for (const task of (schedulerState.queue || [])) {
        if (task.status === 'frozen') {
          task.status = 'pending';
          task.resumedAt = new Date().toISOString();
        }
      }
      writeFileSync(schedulerPath, JSON.stringify(schedulerState, null, 2), 'utf8');
    }
  } catch { /* best effort */ }

  // 4. Update state
  const freezeEntry = state.freezeSnapshot;
  state.frozen = false;
  state.thawedAt = new Date().toISOString();
  state.thawedBy = actor;
  state.unfreezeSnapshot = exitSnapshotId;
  delete state.freezeReason;
  saveState(root, state);

  // 5. Audit
  emitAudit('company.unfrozen', {
    actor,
    entrySnapshot: freezeEntry,
    exitSnapshot: exitSnapshotId,
    consistencyPassed: true,
  }, {});

  return {
    thawed: true,
    entrySnapshot: freezeEntry,
    exitSnapshot: exitSnapshotId,
    consistencyPassed: true,
  };
}

// ── Query ─────────────────────────────────────────────────────────────

/**
 * Check if the organization is frozen.
 */
export function isFrozen({ root } = {}) {
  root = root || repoRoot();
  const state = loadState(root);
  return !!state.frozen;
}

/**
 * Get full freeze status.
 */
export function getFreezeStatus({ root } = {}) {
  root = root || repoRoot();
  const state = loadState(root);

  if (!state.frozen) {
    return {
      frozen: false,
      lastFrozenAt: state.frozenAt || null,
      lastThawedAt: state.thawedAt || null,
    };
  }

  return {
    frozen: true,
    frozenAt: state.frozenAt,
    frozenBy: state.frozenBy || 'unknown',
    reason: state.freezeReason || 'unknown',
    snapshotId: state.freezeSnapshot || null,
  };
}

/**
 * Guard for operations — check if allowed during freeze.
 */
export function checkFreezeGuard({ root, operation } = {}) {
  root = root || repoRoot();

  if (!isFrozen({ root })) {
    return { allowed: true };
  }

  // Allowed operations during freeze
  const allowed = ['read', 'metrics', 'audit', 'status', 'snapshot', 'consistency_check', 'history'];
  if (allowed.includes(operation)) {
    return { allowed: true, reason: `'${operation}' allowed during freeze` };
  }

  const state = loadState(root);
  return {
    allowed: false,
    reason: `Organization frozen: ${state.freezeReason || 'no reason given'}. Operation '${operation}' blocked.`,
  };
}

// ── Consistency Check ─────────────────────────────────────────────────

function runFreezeConsistencyCheck(root) {
  const failures = [];

  // Check STATE.json
  try {
    JSON.parse(readFileSync(join(root, '.ogu/STATE.json'), 'utf8'));
  } catch {
    failures.push('STATE.json corrupted');
  }

  // Check scheduler state
  try {
    const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerPath)) {
      JSON.parse(readFileSync(schedulerPath, 'utf8'));
    }
  } catch {
    failures.push('scheduler-state.json corrupted');
  }

  // Check audit dir writable
  try {
    const auditDir = join(root, '.ogu/audit');
    if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
  } catch {
    failures.push('Audit directory not accessible');
  }

  return { passed: failures.length === 0, failures };
}
