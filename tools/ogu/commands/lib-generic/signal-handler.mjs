/**
 * Signal Handler — register and emit signal handlers.
 */
export function createSignalHandler() {
  const handlers = new Map();

  function on(signal, handler) {
    if (!handlers.has(signal)) handlers.set(signal, []);
    handlers.get(signal).push(handler);
  }

  function off(signal, handler) {
    if (!handlers.has(signal)) return;
    const list = handlers.get(signal).filter(h => h !== handler);
    if (list.length === 0) handlers.delete(signal);
    else handlers.set(signal, list);
  }

  function emit(signal, data) {
    const list = handlers.get(signal);
    if (!list) return;
    for (const h of list) h(data);
  }

  function listSignals() {
    return [...handlers.keys()];
  }

  return { on, off, emit, listSignals };
}
