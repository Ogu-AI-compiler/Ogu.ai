/**
 * Retry Handler — retry function execution with configurable attempts.
 */
export function createRetryHandler({ maxRetries }) {
  function execute(fn) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try { return fn(i); }
      catch (e) { lastError = e; }
    }
    throw lastError;
  }
  return { execute };
}
