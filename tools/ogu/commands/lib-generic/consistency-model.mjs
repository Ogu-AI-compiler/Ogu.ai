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
export function createSaga(name) {
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
