/**
 * Retry Policy — configurable retry strategies.
 */

export const RETRY_STRATEGIES = ['fixed', 'exponential', 'linear'];

/**
 * Create a retry policy.
 *
 * @param {{ strategy?: string, delay?: number, maxRetries?: number }} opts
 * @returns {object} Policy with getDelay/shouldRetry
 */
export function createRetryPolicy({ strategy = 'fixed', delay = 1000, maxRetries = 3 } = {}) {
  function getDelay(attempt) {
    switch (strategy) {
      case 'exponential':
        return delay * Math.pow(2, attempt - 1);
      case 'linear':
        return delay * attempt;
      case 'fixed':
      default:
        return delay;
    }
  }

  function shouldRetry(attempt) {
    return attempt <= maxRetries;
  }

  return { getDelay, shouldRetry, strategy, maxRetries };
}
