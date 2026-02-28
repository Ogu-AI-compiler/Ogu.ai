/**
 * Event Emitter Advanced — on, once, off, emit with wildcard support.
 */
export function createEventEmitterAdvanced() {
  const listeners = new Map();
  const onceListeners = new Map();
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(fn);
  }
  function once(event, fn) {
    if (!onceListeners.has(event)) onceListeners.set(event, []);
    onceListeners.get(event).push(fn);
  }
  function off(event, fn) {
    const arr = listeners.get(event);
    if (arr) listeners.set(event, arr.filter(f => f !== fn));
  }
  function emit(event, data) {
    const arr = listeners.get(event) || [];
    for (const fn of arr) fn(data);
    const onces = onceListeners.get(event) || [];
    for (const fn of onces) fn(data);
    onceListeners.delete(event);
  }
  return { on, once, off, emit };
}
