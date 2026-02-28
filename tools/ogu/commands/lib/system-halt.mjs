/**
 * System Halt — global kill switch for the Ogu compiler.
 *
 * Triggers: `ogu system:halt` OR automatic on FD-AUDIT / FD-FILESYSTEM critical failure.
 *
 * Immediate actions on halt:
 *   1. Stop scheduling (mark scheduler as halted)
 *   2. Checkpoint all running tasks
 *   3. Release all resource slots
 *   4. Write halt record to STATE.json
 *   5. Emergency audit log entry
 *
 * Recovery: `ogu system:resume` requires CTO approval + consistency check pass.
 *
 * State: .ogu/STATE.json (frozen flag + halt record)
 * Halt log: .ogu/state/halt-log.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';
import { getAllBreakerStatus } from './circuit-breaker.mjs';
import { isFrozen } from './company-freeze.mjs';

const HALT_LOG_PATH = (root) => join(root, '.ogu/state/halt-log.json');

// ── Halt ──────────────────────────────────────────────────────────────

/**
 * Emergency system halt.
 *
 * @param {string} root
 * @param {{ reason: string, actor?: string, domain?: string }} opts
 * @returns {{ halted: boolean, checkpoints: number, resourcesReleased: number }}
 */
export function halt(root, { reason, actor, domain } = {}) {
  root = root || repoRoot();

  // 1. Mark STATE.json as frozen
  const statePath = join(root, '.ogu/STATE.json');
  let state = {};
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { state = {}; }
  }

  if (state.halted) {
    return { halted: false, reason: 'System already halted', previousHalt: state.haltRecord };
  }

  state.halted = true;
  state.frozen = true;
  state.haltRecord = {
    reason: reason || 'Manual halt',
    actor: actor || 'system',
    domain: domain || null,
    haltedAt: new Date().toISOString(),
    resumedAt: null,
  };
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  // 2. Checkpoint running tasks
  let checkpoints = 0;
  try {
    const schedulerStatePath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerStatePath)) {
      const schedulerState = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
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
            reason: 'system_halt',
            previousStatus: task.status,
            scheduledAt: task.scheduledAt,
          }, null, 2),
          'utf8'
        );
        task.status = 'halted';
        task.haltedAt = new Date().toISOString();
        checkpoints++;
      }

      schedulerState.halted = true;
      writeFileSync(schedulerStatePath, JSON.stringify(schedulerState, null, 2), 'utf8');
    }
  } catch { /* best effort */ }

  // 3. Release all resource slots
  let resourcesReleased = 0;
  try {
    const activePath = join(root, '.ogu/locks/active.json');
    if (existsSync(activePath)) {
      const active = JSON.parse(readFileSync(activePath, 'utf8'));
      resourcesReleased = (active.slots || []).length;
      active.slots = [];
      writeFileSync(activePath, JSON.stringify(active, null, 2), 'utf8');
    }
  } catch { /* best effort */ }

  // 4. Write halt log
  appendHaltLog(root, {
    action: 'halt',
    reason: reason || 'Manual halt',
    actor: actor || 'system',
    domain: domain || null,
    checkpoints,
    resourcesReleased,
    timestamp: new Date().toISOString(),
  });

  // 5. Emergency audit log
  emitAudit('system.halt', {
    reason,
    actor: actor || 'system',
    domain,
    checkpoints,
    resourcesReleased,
  }, {});

  return { halted: true, checkpoints, resourcesReleased };
}

// ── Resume ────────────────────────────────────────────────────────────

/**
 * Resume system after halt.
 *
 * @param {string} root
 * @param {{ actor: string, approvalRecord?: string }} opts
 * @returns {{ resumed: boolean, reason?: string }}
 */
export function resume(root, { actor, approvalRecord } = {}) {
  root = root || repoRoot();

  const statePath = join(root, '.ogu/STATE.json');
  let state = {};
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch { state = {}; }
  }

  if (!state.halted) {
    return { resumed: false, reason: 'System is not halted' };
  }

  // Require actor
  if (!actor) {
    return { resumed: false, reason: 'Resume requires actor identification' };
  }

  // Run consistency check
  const consistencyResult = runResumeConsistencyCheck(root);
  if (!consistencyResult.passed) {
    return {
      resumed: false,
      reason: `Consistency check failed: ${consistencyResult.failures.join(', ')}`,
      consistencyResult,
    };
  }

  // Resume
  state.halted = false;
  state.frozen = false;
  if (state.haltRecord) {
    state.haltRecord.resumedAt = new Date().toISOString();
    state.haltRecord.resumedBy = actor;
    state.haltRecord.approvalRecord = approvalRecord || null;
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  // Un-halt scheduler
  try {
    const schedulerStatePath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerStatePath)) {
      const schedulerState = JSON.parse(readFileSync(schedulerStatePath, 'utf8'));
      schedulerState.halted = false;

      // Restore halted tasks to pending
      for (const task of (schedulerState.queue || [])) {
        if (task.status === 'halted') {
          task.status = 'pending';
          task.resumedAt = new Date().toISOString();
        }
      }
      writeFileSync(schedulerStatePath, JSON.stringify(schedulerState, null, 2), 'utf8');
    }
  } catch { /* best effort */ }

  appendHaltLog(root, {
    action: 'resume',
    actor,
    approvalRecord: approvalRecord || null,
    consistencyPassed: true,
    timestamp: new Date().toISOString(),
  });

  emitAudit('system.resume', { actor, approvalRecord, consistencyPassed: true }, {});

  return { resumed: true, consistencyResult };
}

// ── Health ────────────────────────────────────────────────────────────

/**
 * Get overall system health across all failure domains.
 */
export function getSystemHealth(root) {
  root = root || repoRoot();

  // Check halt status
  const statePath = join(root, '.ogu/STATE.json');
  let halted = false;
  let haltRecord = null;
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      halted = !!state.halted;
      haltRecord = state.haltRecord || null;
    } catch { /* skip */ }
  }

  // Load circuit breaker status
  let breakerStatus = [];
  try {
    breakerStatus = getAllBreakerStatus(root);
  } catch { /* skip */ }

  // Degraded modes active
  const activeDegradedModes = [];
  for (const b of breakerStatus) {
    if (b.breakerState === 'open' && b.degradedMode) {
      activeDegradedModes.push({ domain: b.domainId, mode: b.degradedMode });
    }
  }

  // Check freeze status
  let frozen = false;
  try {
    frozen = isFrozen({ root });
  } catch { /* skip */ }

  const overallHealth = halted ? 'HALTED'
    : activeDegradedModes.length > 0 ? 'DEGRADED'
    : frozen ? 'FROZEN'
    : 'HEALTHY';

  return {
    overallHealth,
    halted,
    haltRecord,
    frozen,
    activeDegradedModes,
    domains: breakerStatus,
  };
}

// ── Halt Log ──────────────────────────────────────────────────────────

function appendHaltLog(root, entry) {
  const path = HALT_LOG_PATH(root);
  const dir = join(root, '.ogu/state');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let log = [];
  if (existsSync(path)) {
    try { log = JSON.parse(readFileSync(path, 'utf8')); } catch { log = []; }
  }
  log.push(entry);
  writeFileSync(path, JSON.stringify(log, null, 2), 'utf8');
}

export function getHaltLog(root) {
  root = root || repoRoot();
  const path = HALT_LOG_PATH(root);
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return []; }
}

// ── Consistency Check for Resume ──────────────────────────────────────

function runResumeConsistencyCheck(root) {
  const failures = [];

  // Check STATE.json is valid
  try {
    const statePath = join(root, '.ogu/STATE.json');
    JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    failures.push('STATE.json is corrupted');
  }

  // Check scheduler state is valid
  try {
    const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
    if (existsSync(schedulerPath)) {
      JSON.parse(readFileSync(schedulerPath, 'utf8'));
    }
  } catch {
    failures.push('scheduler-state.json is corrupted');
  }

  // Check audit log directory exists and is writable
  try {
    const auditDir = join(root, '.ogu/audit');
    if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
    const testPath = join(auditDir, '.write-test');
    writeFileSync(testPath, 'test', 'utf8');
    unlinkSync(testPath);
  } catch {
    failures.push('Audit directory is not writable');
  }

  return { passed: failures.length === 0, failures };
}
