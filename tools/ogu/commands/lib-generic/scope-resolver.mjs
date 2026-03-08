/**
 * Scope Resolver — resolve variable scopes in nested blocks.
 */

export function createScopeResolver() {
  const scopes = [new Map()]; // stack, index 0 = global

  function openScope(label) {
    scopes.push(new Map());
  }

  function closeScope() {
    if (scopes.length <= 1) throw new Error("Cannot close global scope");
    scopes.pop();
  }

  function declare(name, info) {
    scopes[scopes.length - 1].set(name, info);
  }

  function resolve(name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) return scopes[i].get(name);
    }
    return null;
  }

  return { openScope, closeScope, declare, resolve };
}
