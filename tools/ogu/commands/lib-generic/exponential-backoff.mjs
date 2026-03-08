/**
 * Exponential Backoff — calculate backoff delays with exponential growth.
 */

/**
 * @param {{ baseMs: number, maxMs: number, factor?: number }} opts
 */
export function createBackoff({ baseMs = 100, maxMs = 30000, factor = 2 } = {}) {
  let attempt = 0;

  function next() {
    const delay = Math.min(baseMs * Math.pow(factor, attempt), maxMs);
    attempt++;
    return delay;
  }

  function reset() {
    attempt = 0;
  }

  function getAttempt() {
    return attempt;
  }

  return { next, reset, getAttempt };
}
