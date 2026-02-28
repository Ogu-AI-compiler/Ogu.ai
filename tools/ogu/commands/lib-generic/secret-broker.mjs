/**
 * Secret Broker — secret injection with TTL and audit trail.
 */

/**
 * Create a secret broker with TTL support and audit logging.
 *
 * @returns {object} Broker with issueSecret/getSecret/revokeSecret/listSecrets/buildSecureEnv/getAuditTrail
 */
export function createSecretBroker() {
  const secrets = new Map(); // name → { value, expiresAt }
  const audit = [];

  function log(action, name) {
    audit.push({ action, name, timestamp: new Date().toISOString() });
  }

  function issueSecret(name, value, { ttlMs } = {}) {
    const expiresAt = ttlMs != null ? Date.now() + ttlMs : null;
    secrets.set(name, { value, expiresAt });
    log('issue', name);
  }

  function getSecret(name) {
    const entry = secrets.get(name);
    if (!entry) { log('get_miss', name); return null; }
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      secrets.delete(name);
      log('get_expired', name);
      return null;
    }
    log('get', name);
    return entry.value;
  }

  function revokeSecret(name) {
    secrets.delete(name);
    log('revoke', name);
  }

  function listSecrets() {
    // Prune expired first
    for (const [name, entry] of secrets) {
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        secrets.delete(name);
      }
    }
    return Array.from(secrets.keys());
  }

  function buildSecureEnv() {
    const env = {};
    for (const [name, entry] of secrets) {
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) continue;
      env[name] = entry.value;
    }
    return env;
  }

  function getAuditTrail() {
    return [...audit];
  }

  return { issueSecret, getSecret, revokeSecret, listSecrets, buildSecureEnv, getAuditTrail };
}
