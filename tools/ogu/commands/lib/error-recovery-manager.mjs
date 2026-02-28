/**
 * Error Recovery Manager — match errors to recovery strategies.
 */
export function createErrorRecoveryManager() {
  const strategies = [];
  const history = [];

  function addStrategy({ pattern, action, maxAttempts }) {
    strategies.push({ pattern, action, maxAttempts: maxAttempts || 1 });
  }

  function recover(error) {
    const msg = error.message || String(error);
    for (const s of strategies) {
      if (s.pattern.test(msg)) {
        const result = { action: s.action, maxAttempts: s.maxAttempts, error: msg, matched: true };
        history.push(result);
        return result;
      }
    }
    const result = { action: "escalate", error: msg, matched: false };
    history.push(result);
    return result;
  }

  function getHistory() { return [...history]; }

  return { addStrategy, recover, getHistory };
}
