/**
 * Type Resolver — resolve type references, unions, and aliases.
 */

const PRIMITIVES = new Set(["string", "number", "boolean", "object", "array", "null", "undefined"]);

export function createTypeResolver() {
  const types = new Map();

  function define(name, info) {
    types.set(name, info);
  }

  function resolve(name) {
    if (PRIMITIVES.has(name)) {
      return { kind: "primitive", name };
    }
    const info = types.get(name);
    if (!info) return null;
    return { ...info, name };
  }

  function listTypes() {
    return [...types.keys()];
  }

  return { define, resolve, listTypes };
}
