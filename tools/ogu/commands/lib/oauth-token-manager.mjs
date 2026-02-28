/**
 * OAuth Token Manager — manage OAuth access and refresh tokens.
 */
export function createOAuthTokenManager() {
  const tokens = new Map();
  function store(clientId, { accessToken, refreshToken, expiresIn }) {
    tokens.set(clientId, { accessToken, refreshToken, expiresAt: Date.now() + (expiresIn != null ? expiresIn : 3600) * 1000 });
  }
  function getAccessToken(clientId, now = Date.now()) {
    const t = tokens.get(clientId);
    if (!t) return null;
    if (now >= t.expiresAt) return null;
    return t.accessToken;
  }
  function getRefreshToken(clientId) {
    const t = tokens.get(clientId);
    return t ? t.refreshToken : null;
  }
  function isExpired(clientId, now = Date.now()) {
    const t = tokens.get(clientId);
    return !t || now >= t.expiresAt;
  }
  function revoke(clientId) { tokens.delete(clientId); }
  function list() { return [...tokens.keys()]; }
  return { store, getAccessToken, getRefreshToken, isExpired, revoke, list };
}
