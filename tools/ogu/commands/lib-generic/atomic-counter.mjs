/**
 * Atomic Counter — thread-safe-style counter with CAS semantics.
 */
export function createAtomicCounter(initial = 0) {
  let value = initial;
  function increment() { value++; }
  function decrement() { value--; }
  function get() { return value; }
  function getAndIncrement() { const old = value; value++; return old; }
  function getAndDecrement() { const old = value; value--; return old; }
  function set(v) { value = v; }
  return { increment, decrement, get, getAndIncrement, getAndDecrement, set };
}
