/**
 * Debouncer — delay execution until calls stop.
 */
export function createDebouncer({ delayMs }) {
  let pending = null;
  let timer = null;
  function call(fn) {
    pending = fn;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { if (pending) { pending(); pending = null; } }, delayMs);
  }
  function flush() { if (timer) clearTimeout(timer); if (pending) { pending(); pending = null; } }
  function cancel() { if (timer) clearTimeout(timer); pending = null; }
  return { call, flush, cancel };
}
