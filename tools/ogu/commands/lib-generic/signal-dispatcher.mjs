/**
 * Signal Dispatcher — dispatch and handle OS-style signals.
 */
export function createSignalDispatcher() {
  const handlers = new Map();
  const history = [];
  function on(signal, handler) {
    if (!handlers.has(signal)) handlers.set(signal, []);
    handlers.get(signal).push(handler);
  }
  function dispatch(signal, data) {
    history.push({ signal, data, time: Date.now() });
    const fns = handlers.get(signal) || [];
    const results = fns.map(fn => fn(data));
    return results;
  }
  function off(signal) { handlers.delete(signal); }
  function getHistory() { return [...history]; }
  function listSignals() { return [...handlers.keys()]; }
  return { on, dispatch, off, getHistory, listSignals };
}
