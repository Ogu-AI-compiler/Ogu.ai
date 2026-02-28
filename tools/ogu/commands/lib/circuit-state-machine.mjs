/**
 * Circuit State Machine — circuit breaker with state transitions.
 */
export function createCircuitStateMachine({ failureThreshold = 3, resetTimeoutMs = 5000 } = {}) {
  let state = 'CLOSED';
  let failures = 0;
  let lastFailureTime = 0;
  function call(fn, now = Date.now()) {
    if (state === 'OPEN') {
      if (now - lastFailureTime >= resetTimeoutMs) {
        state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit is OPEN');
      }
    }
    try {
      const result = fn();
      if (state === 'HALF_OPEN') { state = 'CLOSED'; failures = 0; }
      return result;
    } catch (e) {
      failures++;
      lastFailureTime = now;
      if (failures >= failureThreshold) state = 'OPEN';
      throw e;
    }
  }
  function getState() { return state; }
  function getFailures() { return failures; }
  function reset() { state = 'CLOSED'; failures = 0; lastFailureTime = 0; }
  return { call, getState, getFailures, reset };
}
