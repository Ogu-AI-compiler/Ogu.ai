/**
 * Token Refresher — manage token lifecycle with auto-refresh.
 */
export function createTokenRefresher(refreshFn, ttlMs = 60000) {
  let token = null;
  let expiresAt = 0;
  let refreshCount = 0;
  function getToken(now = Date.now()) {
    if (!token || now >= expiresAt) {
      token = refreshFn();
      expiresAt = now + ttlMs;
      refreshCount++;
    }
    return token;
  }
  function isExpired(now = Date.now()) { return !token || now >= expiresAt; }
  function invalidate() { token = null; expiresAt = 0; }
  function getRefreshCount() { return refreshCount; }
  return { getToken, isExpired, invalidate, getRefreshCount };
}
