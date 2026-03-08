/**
 * secret-broker.mjs — In-memory secret store with TTL and revocation.
 */
export function createSecretBroker() {
  const store = new Map();

  return {
    issueSecret(key, value, { ttlMs } = {}) {
      store.set(key, { value, issuedAt: Date.now(), expiresAt: ttlMs ? Date.now() + ttlMs : null });
    },
    getSecret(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) { store.delete(key); return null; }
      return entry.value;
    },
    revokeSecret(key) { store.delete(key); },
    listKeys() {
      const now = Date.now();
      return [...store.entries()].filter(([, e]) => !e.expiresAt || now <= e.expiresAt).map(([k]) => k);
    },
  };
}
