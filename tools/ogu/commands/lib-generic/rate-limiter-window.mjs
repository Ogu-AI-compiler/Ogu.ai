/**
 * Rate Limiter Window — time-window based rate limiting.
 */
export function createRateLimiterWindow(maxRequests, windowMs) {
  const windows = new Map();
  function allow(key, now = Date.now()) {
    if (!windows.has(key)) windows.set(key, []);
    const reqs = windows.get(key).filter(t => now - t < windowMs);
    windows.set(key, reqs);
    if (reqs.length >= maxRequests) return false;
    reqs.push(now);
    return true;
  }
  function remaining(key, now = Date.now()) {
    const reqs = (windows.get(key) || []).filter(t => now - t < windowMs);
    return Math.max(0, maxRequests - reqs.length);
  }
  function reset(key) { windows.delete(key); }
  function resetAll() { windows.clear(); }
  return { allow, remaining, reset, resetAll };
}
