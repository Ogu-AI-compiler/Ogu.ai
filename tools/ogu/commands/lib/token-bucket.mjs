/**
 * Token Bucket — rate limiting with token replenishment.
 */
export function createTokenBucket({ capacity, tokensPerInterval }) {
  let tokens = capacity;
  function consume(count) {
    if (tokens >= count) { tokens -= count; return true; }
    return false;
  }
  function refill() { tokens = Math.min(capacity, tokens + tokensPerInterval); }
  function getTokens() { return tokens; }
  return { consume, refill, getTokens };
}
