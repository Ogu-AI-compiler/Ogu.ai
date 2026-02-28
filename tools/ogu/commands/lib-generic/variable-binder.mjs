/**
 * Variable Binder — bind variables to values with lifetime tracking.
 */

export function createVariableBinder() {
  const bindings = new Map();

  function bind(name, value) {
    bindings.set(name, { value, boundAt: Date.now() });
  }

  function get(name) {
    const entry = bindings.get(name);
    return entry ? entry.value : undefined;
  }

  function unbind(name) {
    bindings.delete(name);
  }

  function listBindings() {
    return [...bindings.entries()].map(([name, entry]) => ({
      name,
      value: entry.value,
      boundAt: entry.boundAt,
    }));
  }

  return { bind, get, unbind, listBindings };
}
