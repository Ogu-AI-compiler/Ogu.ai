/**
 * Command Dispatcher — route commands to handlers with validation.
 */

/**
 * Create a command dispatcher.
 *
 * @returns {object} Dispatcher with register/unregister/dispatch/listCommands
 */
export function createDispatcher() {
  const handlers = new Map();

  function register(command, handler) {
    handlers.set(command, handler);
  }

  function unregister(command) {
    handlers.delete(command);
  }

  async function dispatch(command, args = {}) {
    const handler = handlers.get(command);
    if (!handler) throw new Error(`Unknown command: "${command}"`);
    return await handler(args);
  }

  function listCommands() {
    return Array.from(handlers.keys());
  }

  return { register, unregister, dispatch, listCommands };
}
