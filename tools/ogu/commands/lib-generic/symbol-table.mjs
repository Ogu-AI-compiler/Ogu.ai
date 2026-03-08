/**
 * Symbol Table — manage symbols with scope hierarchy.
 */

export function createSymbolTable() {
  const scopes = [new Map()]; // stack of scopes, index 0 = global

  function define(name, info) {
    scopes[scopes.length - 1].set(name, info);
  }

  function lookup(name) {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) return scopes[i].get(name);
    }
    return null;
  }

  function enterScope(label) {
    scopes.push(new Map());
  }

  function exitScope() {
    if (scopes.length <= 1) throw new Error("Cannot exit global scope");
    scopes.pop();
  }

  function currentDepth() {
    return scopes.length - 1;
  }

  return { define, lookup, enterScope, exitScope, currentDepth };
}
