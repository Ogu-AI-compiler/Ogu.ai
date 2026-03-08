import { randomUUID } from 'node:crypto';

/**
 * SAGA Transaction Manager — distributed transaction pattern.
 *
 * Each saga consists of ordered steps with action + compensate.
 * On failure, compensating actions run in reverse order.
 */

/**
 * Create a new SAGA transaction.
 *
 * @param {object} opts
 * @param {string} opts.name
 * @returns {{ id, name, status, steps, createdAt }}
 */
export function createSaga({ name } = {}) {
  return {
    id: randomUUID(),
    name,
    status: 'pending',
    steps: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Add a step to a saga.
 *
 * @param {object} saga
 * @param {object} step
 * @param {string} step.name
 * @param {Function} step.action - Forward action
 * @param {Function} step.compensate - Compensating action (rollback)
 */
export function addStep(saga, { name, action, compensate }) {
  saga.steps.push({ name, action, compensate, status: 'pending' });
}

/**
 * Execute a saga — run all steps, compensate on failure.
 *
 * @param {object} saga
 * @returns {{ status: 'completed'|'compensated', stepResults: Array, failedStep?: string, error?: string }}
 */
export async function executeSaga(saga) {
  saga.status = 'running';
  const stepResults = [];
  let failedIdx = -1;

  for (let i = 0; i < saga.steps.length; i++) {
    const step = saga.steps[i];
    try {
      step.status = 'running';
      const result = await step.action();
      step.status = 'completed';
      stepResults.push({ name: step.name, status: 'completed', result });
    } catch (err) {
      step.status = 'failed';
      stepResults.push({ name: step.name, status: 'failed', error: err.message });
      failedIdx = i;
      break;
    }
  }

  if (failedIdx < 0) {
    saga.status = 'completed';
    return { status: 'completed', stepResults };
  }

  // Compensate in reverse order (only completed steps)
  for (let i = failedIdx - 1; i >= 0; i--) {
    const step = saga.steps[i];
    try {
      await step.compensate();
      step.status = 'compensated';
    } catch { /* best effort */ }
  }

  saga.status = 'compensated';
  return {
    status: 'compensated',
    stepResults,
    failedStep: saga.steps[failedIdx].name,
    error: stepResults[failedIdx]?.error,
  };
}
