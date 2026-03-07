/**
 * Circuit Breaker Prober Loop.
 *
 * Runs every 15s to probe half-open circuit breakers:
 * - Reads .ogu/state/circuit-breakers.json
 * - For breakers in "open" state past cooldown → transitions to "half-open"
 * - For breakers in "half-open" → runs a lightweight probe
 * - On probe success → closes the breaker
 * - On probe failure → reopens the breaker
 *
 * Probes are non-destructive health checks per failure domain.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getAuditDir, getBudgetDir, getStateDir, resolveOguPath } from '../../ogu/commands/lib/runtime-paths.mjs';

const BREAKER_PATH = (root) => join(getStateDir(root), 'circuit-breakers.json');

const DEFAULT_COOLDOWN_MS = 60000; // 1 minute

// Probe functions per failure domain
const probes = {
  'FD-PROVIDER': probeProvider,
  'FD-FILESYSTEM': probeFilesystem,
  'FD-BUDGET': probeBudget,
  'FD-SCHEDULER': probeScheduler,
  // FD-AUDIT has no breaker (halts system instead)
};

function probeProvider(root) {
  // Check if provider config exists and is readable
  const orgPath = resolveOguPath(root, 'OrgSpec.json');
  if (!existsSync(orgPath)) return { ok: true, reason: 'no orgspec (ok)' };
  try {
    const org = JSON.parse(readFileSync(orgPath, 'utf8'));
    return { ok: !!org.providers, reason: org.providers ? 'providers found' : 'no providers' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function probeFilesystem(root) {
  // Check critical paths are readable
  const paths = [getStateDir(root), getAuditDir(root), getBudgetDir(root)];
  for (const p of paths) {
    if (!existsSync(p)) {
      return { ok: false, reason: `Missing: ${p.replace(`${root}/`, '')}` };
    }
  }
  // Try a write test
  const testPath = join(getStateDir(root), '.probe-test');
  try {
    writeFileSync(testPath, 'probe', 'utf8');
    unlinkSync(testPath);
    return { ok: true, reason: 'filesystem writable' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function probeBudget(root) {
  const budgetPath = join(getBudgetDir(root), 'budget-state.json');
  if (!existsSync(budgetPath)) return { ok: true, reason: 'no budget file (ok)' };
  try {
    JSON.parse(readFileSync(budgetPath, 'utf8'));
    return { ok: true, reason: 'budget readable' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function probeScheduler(root) {
  const schedulerPath = join(getStateDir(root), 'scheduler-state.json');
  if (!existsSync(schedulerPath)) return { ok: true, reason: 'no scheduler state (ok)' };
  try {
    const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
    return { ok: !!state.queue, reason: state.queue ? 'scheduler readable' : 'no queue' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export function createCircuitProberLoop({ root, intervalMs, emitAudit }) {
  let timer = null;
  let running = true;
  let lastTick = null;
  let tickCount = 0;

  const tick = async () => {
    lastTick = new Date().toISOString();
    tickCount++;

    const breakerPath = BREAKER_PATH(root);
    if (!existsSync(breakerPath)) return;

    let breakers;
    try {
      breakers = JSON.parse(readFileSync(breakerPath, 'utf8'));
    } catch { return; }

    const now = Date.now();
    let changed = false;

    for (const [domainId, breaker] of Object.entries(breakers)) {
      if (!breaker || typeof breaker !== 'object') continue;

      // Open → check cooldown → half-open
      if (breaker.state === 'open') {
        const openedAt = new Date(breaker.lastFailureAt || breaker.openedAt || 0).getTime();
        const cooldown = breaker.cooldownMs || DEFAULT_COOLDOWN_MS;
        if (now - openedAt > cooldown) {
          breaker.state = 'half-open';
          breaker.halfOpenAt = new Date().toISOString();
          changed = true;
          emitAudit('circuit.half_open', { domainId, cooldownMs: cooldown });
        }
      }

      // Half-open → probe
      if (breaker.state === 'half-open') {
        const probeFn = probes[domainId];
        if (!probeFn) continue;

        let result;
        try {
          result = probeFn(root);
          // Handle if probe returns a promise (probeFilesystem uses dynamic import)
          if (result && typeof result.then === 'function') result = await result;
        } catch (err) {
          result = { ok: false, reason: err.message };
        }

        if (result.ok) {
          breaker.state = 'closed';
          breaker.closedAt = new Date().toISOString();
          breaker.failureCount = 0;
          changed = true;
          emitAudit('circuit.closed', { domainId, reason: result.reason });
        } else {
          breaker.state = 'open';
          breaker.reopenedAt = new Date().toISOString();
          changed = true;
          emitAudit('circuit.reopened', { domainId, reason: result.reason });
        }
      }
    }

    if (changed) {
      writeFileSync(breakerPath, JSON.stringify(breakers, null, 2), 'utf8');
    }
  };

  timer = setInterval(async () => {
    if (!running) return;
    try { await tick(); }
    catch (err) { emitAudit('circuit_prober.loop_error', { error: err.message }); }
  }, intervalMs);

  return {
    name: 'circuit-prober',
    get isRunning() { return running; },
    get lastTick() { return lastTick; },
    get tickCount() { return tickCount; },
    stop() { running = false; clearInterval(timer); },
    forceTick: tick,
  };
}
