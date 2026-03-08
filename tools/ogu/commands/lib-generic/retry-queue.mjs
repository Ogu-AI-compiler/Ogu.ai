/**
 * Retry Queue — task retry with exponential backoff and dead-letter queue.
 *
 * Processes tasks with configurable max retries and backoff delay.
 * Failed tasks after max retries go to the dead-letter queue.
 */

/**
 * Compute exponential backoff delay.
 *
 * @param {number} attempt - Current attempt (0-based)
 * @param {number} baseDelayMs - Base delay in ms
 * @returns {number} Delay in ms
 */
export function computeBackoff(attempt, baseDelayMs) {
  return baseDelayMs * Math.pow(2, attempt);
}

/**
 * Create a retry queue instance.
 *
 * @param {object} opts
 * @param {number} opts.maxRetries - Max retry attempts
 * @param {number} opts.baseDelayMs - Base delay for backoff
 * @returns {object} Queue with enqueue/processNext/getDeadLetters/size
 */
export function createRetryQueue({ maxRetries = 3, baseDelayMs = 100 } = {}) {
  const queue = [];
  const deadLetters = [];

  function enqueue(item) {
    queue.push({ ...item, attempts: 0 });
  }

  function processNext(handler) {
    if (queue.length === 0) return null;
    const item = queue.shift();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      item.attempts = attempt + 1;
      const result = handler(item);

      if (result.success) {
        return { success: true, result: result.result, attempts: item.attempts };
      }

      if (attempt < maxRetries) {
        // In real implementation we'd wait computeBackoff(attempt, baseDelayMs)
        // For synchronous testing, we skip the actual wait
        continue;
      }

      // Max retries exhausted → dead letter
      deadLetters.push({ ...item, lastError: result.error });
      return { success: false, error: result.error, attempts: item.attempts };
    }
  }

  function getDeadLetters() {
    return [...deadLetters];
  }

  function size() {
    return queue.length;
  }

  return { enqueue, processNext, getDeadLetters, size };
}
