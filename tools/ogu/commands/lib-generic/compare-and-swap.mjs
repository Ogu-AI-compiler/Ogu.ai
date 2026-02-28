/**
 * Compare-And-Swap — CAS register for atomic operations.
 */
export function createCASRegister(initial) {
  let value = initial;
  function compareAndSwap(expected, desired) {
    if (value === expected) { value = desired; return true; }
    return false;
  }
  function get() { return value; }
  function set(v) { value = v; }
  return { compareAndSwap, get, set };
}
