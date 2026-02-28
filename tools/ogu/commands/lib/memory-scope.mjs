/**
 * Memory Scope — restrict agent memory access based on role.
 */

/**
 * Create a memory scope manager.
 *
 * @param {{ allowedScopes: string[] }} opts
 * @returns {object} Scope with canAccess/read/write/listEntries
 */
export function createMemoryScope({ allowedScopes = [] }) {
  const scopeSet = new Set(allowedScopes);
  const hasAll = scopeSet.has('all');
  const store = new Map(); // "scope:key" → value

  function canAccess(scope) {
    return hasAll || scopeSet.has(scope);
  }

  function assertAccess(scope) {
    if (!canAccess(scope)) {
      throw new Error(`Access denied to scope: ${scope}`);
    }
  }

  function write(scope, key, value) {
    assertAccess(scope);
    store.set(`${scope}:${key}`, value);
  }

  function read(scope, key) {
    assertAccess(scope);
    return store.get(`${scope}:${key}`) || null;
  }

  function listEntries(scope) {
    assertAccess(scope);
    const prefix = `${scope}:`;
    const entries = [];
    for (const [k, v] of store) {
      if (k.startsWith(prefix)) {
        entries.push({ key: k.slice(prefix.length), value: v });
      }
    }
    return entries;
  }

  return { canAccess, read, write, listEntries };
}
