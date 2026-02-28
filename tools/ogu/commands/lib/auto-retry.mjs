import { getRetryStrategy } from './error-recovery.mjs';

/**
 * Auto-Retry — executes a function with automatic retry, backoff, and escalation.
 *
 * Integrates with error-recovery.mjs for category-based retry strategies.
 */

/**
 * Execute a function with automatic retry based on error category.
 *
 * @param {object} options
 * @param {Function} options.fn — Async function to execute (should return { status, data })
 * @param {string} options.category — Error category (transient, quality, budget, etc.)
 * @param {number} [options.maxRetries] — Override max retries from strategy
 * @param {number} [options.backoffMs] — Override backoff from strategy
 * @returns {Promise<{ status: string, data?: any, attempts: number, shouldEscalate?: boolean, errors?: string[] }>}
 */
export async function executeWithRetry(options) {
  const { fn, category, maxRetries: maxRetriesOverride, backoffMs: backoffOverride } = options;

  const strategy = getRetryStrategy(category);
  const maxRetries = maxRetriesOverride ?? strategy.maxRetries;
  const backoffMs = backoffOverride ?? strategy.backoffMs;

  const errors = [];
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;

    try {
      const result = await fn();
      return {
        ...result,
        attempts,
        shouldEscalate: false,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      errors.push(err.message);

      // If this was the last attempt, don't backoff
      if (attempt === maxRetries) break;

      // Backoff before retry
      if (backoffMs > 0) {
        const delay = strategy.strategy === 'exponential-backoff'
          ? backoffMs * Math.pow(2, attempt)
          : backoffMs;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  return {
    status: 'failed',
    attempts,
    shouldEscalate: strategy.escalate,
    errors,
  };
}
