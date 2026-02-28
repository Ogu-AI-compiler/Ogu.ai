/**
 * Throttler — limit execution frequency.
 */
export function createThrottler({ intervalMs }) {
  let lastCall = 0;
  function tryCall(fn) {
    const now = Date.now();
    if (now - lastCall < intervalMs) return false;
    lastCall = now;
    fn();
    return true;
  }
  return { tryCall };
}
