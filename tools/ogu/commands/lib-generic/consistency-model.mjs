/**
 * Consistency Model — SAGA transaction boundaries with prepare-execute-commit.
 */

export const SAGA_STATES = ['pending', 'executing', 'completed', 'compensating', 'compensated', 'failed'];

/**
 * Create a SAGA transaction.
 *
 * @param {string} name
 * @returns {object} Saga with step/execute/getStatus
 */
export function createSaga(name, stepsArray) {
  // If stepsArray provided, use array-based saga
  if (stepsArray) return _createSagaFromArray(name, stepsArray);

  const steps = []; // { name, doFn, compensateFn }
  let state = 'pending';
  let error = null;

  function step(stepName, doFn, compensateFn) {
    steps.push({ name: stepName, doFn, compensateFn });
  }

  async function execute() {
    state = 'executing';
    const completed = []; // indices of successfully executed steps

    for (let i = 0; i < steps.length; i++) {
      try {
        await steps[i].doFn();
        completed.push(i);
      } catch (e) {
        error = e;
        // Compensate in reverse order
        state = 'compensating';
        for (let j = completed.length - 1; j >= 0; j--) {
          try {
            await steps[completed[j]].compensateFn();
          } catch (_) {
            // Swallow compensation errors
          }
        }
        state = 'compensated';
        throw e;
      }
    }

    state = 'completed';
  }

  function getStatus() {
    return {
      name,
      state,
      stepCount: steps.length,
      error: error ? error.message : null,
    };
  }

  return { step, execute, getStatus };
}

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Check consistency of the .ogu/ state for a feature.
 */
export function checkConsistency(root, featureSlug) {
  const issues = [];
  const oguDir = join(root, '.ogu');

  // Check scheduler state
  const schedulerState = join(root, '.ogu/state/scheduler-state.json');
  if (existsSync(schedulerState)) {
    try { JSON.parse(readFileSync(schedulerState, 'utf8')); }
    catch { issues.push({ layer: 'state', file: 'scheduler-state.json', reason: 'invalid JSON' }); }
  }

  // Check STATE.json
  const stateFile = join(oguDir, 'STATE.json');
  if (existsSync(stateFile)) {
    try { JSON.parse(readFileSync(stateFile, 'utf8')); }
    catch { issues.push({ layer: 'state', file: 'STATE.json', reason: 'invalid JSON' }); }
  }

  return { consistent: issues.length === 0, issueCount: issues.length, issues, checkedAt: new Date().toISOString(), featureSlug };
}

/**
 * Create a saga with array-based steps API.
 * Overloaded: accepts (name, stepsArray) for compatibility with tests.
 */
const _originalCreateSaga = createSaga;
// Re-export with extended signature
export { createSaga as _legacySaga };

/**
 * Execute a saga created with array steps.
 */
export async function executeSaga(saga, root) {
  if (typeof saga.execute === 'function') {
    return saga.execute(root);
  }
  throw new Error('Invalid saga object');
}

/**
 * Create idempotency key.
 */
export function createIdempotencyKey(operation, params) {
  const data = JSON.stringify({ operation, params });
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Check if operation was already executed (idempotency).
 */
export function checkIdempotency(root, key) {
  const dir = join(root, '.ogu/state');
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'idempotency-log.json');
  if (!existsSync(p)) return { duplicate: false };
  const log = JSON.parse(readFileSync(p, 'utf8'));
  if (log[key]) return { duplicate: true, originalResult: log[key] };
  return { duplicate: false };
}

/**
 * Record an operation as executed.
 */
export function recordIdempotency(root, key, result) {
  const dir = join(root, '.ogu/state');
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'idempotency-log.json');
  const log = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  log[key] = { ...result, recordedAt: new Date().toISOString() };
  writeFileSync(p, JSON.stringify(log, null, 2));
}

/**
 * Reconcile state across all features.
 */
export function reconcile(root) {
  const check = checkConsistency(root, '*');
  return { reconciled: check.consistent, issueCount: check.issueCount, issues: check.issues, checkedAt: check.checkedAt };
}

/**
 * Internal: create saga from array of step objects.
 */
function _createSagaFromArray(name, stepsArray) {
  const _s = { state: 'pending' };
  const results = {};

  const saga = Object.defineProperties({}, {
    state: { get() { return _s.state; }, enumerable: true },
    name: { value: name, enumerable: true },
    steps: { value: stepsArray, enumerable: true },
    results: { get() { return results; }, enumerable: true },
  });

  saga.execute = async function(root) {
    _s.state = 'executing';
    const executed = [];
    for (const step of stepsArray) {
      try {
        results[step.name] = await step.execute(root);
        executed.push(step);
      } catch (e) {
        _s.state = 'compensating';
        for (let i = executed.length - 1; i >= 0; i--) {
          try { await executed[i].compensate(root); } catch (_e) {}
        }
        _s.state = 'compensated';
        throw e;
      }
    }
    _s.state = 'completed';
    return { state: _s.state, results };
  };

  saga.getStatus = function() { return { state: _s.state, name, stepCount: stepsArray.length }; };

  return saga;
}
