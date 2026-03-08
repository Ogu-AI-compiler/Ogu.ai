/**
 * Operator Registry — register and apply named operators.
 */
export function createOperatorRegistry() {
  const operators = new Map();

  function register(name, fn) {
    operators.set(name, fn);
  }

  function apply(name, ...args) {
    const fn = operators.get(name);
    if (!fn) throw new Error(`operator ${name} not found`);
    return fn(...args);
  }

  function has(name) {
    return operators.has(name);
  }

  function list() {
    return [...operators.keys()];
  }

  return { register, apply, has, list };
}
