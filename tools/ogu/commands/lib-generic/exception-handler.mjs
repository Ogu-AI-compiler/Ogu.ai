/**
 * Exception Handler — register and raise CPU exceptions.
 */
export function createExceptionHandler() {
  const handlers = new Map();
  const log = [];
  function register(type, handler) { handlers.set(type, handler); }
  function raise(type, data) {
    const h = handlers.get(type);
    if (h) { h(data); }
    else { log.push({ type, data, timestamp: Date.now() }); }
  }
  function getLog() { return [...log]; }
  return { register, raise, getLog };
}
