/**
 * Backoff Strategy — exponential, linear, and constant backoff.
 */
export function exponentialBackoff(attempt, baseDelay) {
  return baseDelay * Math.pow(2, attempt);
}

export function linearBackoff(attempt, baseDelay) {
  return baseDelay * (attempt + 1);
}

export function constantBackoff(attempt, baseDelay) {
  return baseDelay;
}
