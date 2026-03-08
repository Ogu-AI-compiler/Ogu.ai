/**
 * API Key Manager — manage API keys with scopes.
 */
export function createAPIKeyManager() {
  const keys = new Map();
  function create(name, scopes = []) {
    const key = `key_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    keys.set(key, { name, scopes: new Set(scopes), createdAt: Date.now(), active: true });
    return key;
  }
  function validate(key) { const k = keys.get(key); return k ? k.active : false; }
  function hasScope(key, scope) { const k = keys.get(key); return k ? k.scopes.has(scope) : false; }
  function revoke(key) { const k = keys.get(key); if (k) k.active = false; }
  function list() { return [...keys.entries()].map(([key, v]) => ({ key, name: v.name, active: v.active })); }
  return { create, validate, hasScope, revoke, list };
}
