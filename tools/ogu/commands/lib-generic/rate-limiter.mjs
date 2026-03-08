/**
 * Rate Limiter — token bucket algorithm for API/LLM call throttling.
 */

export const RATE_PRESETS = {
  api:  { maxTokens: 100, refillRate: 10 },  // 100 burst, 10/sec refill
  llm:  { maxTokens: 20,  refillRate: 2 },   // 20 burst, 2/sec refill
  bulk: { maxTokens: 50,  refillRate: 5 },
};

/**
 * Create a token bucket rate limiter.
 *
 * @param {{ maxTokens: number, refillRate: number }} opts
 * @returns {object} Limiter with tryConsume/getState
 */
export function createRateLimiter({ maxTokens, refillRate }) {
  let tokens = maxTokens;
  let lastRefill = Date.now();

  function refill() {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(maxTokens, tokens + elapsed * refillRate);
    lastRefill = now;
  }

  function tryConsume(count = 1) {
    refill();
    if (tokens >= count) {
      tokens -= count;
      return true;
    }
    return false;
  }

  function getState() {
    refill();
    return {
      tokens: Math.floor(tokens),
      maxTokens,
      refillRate,
    };
  }

  function tryAcquire(cost = 1) {
    return tryConsume(cost);
  }

  function getTokens() {
    refill();
    return Math.floor(tokens);
  }

  return { tryConsume, tryAcquire, getState, getTokens };
}
