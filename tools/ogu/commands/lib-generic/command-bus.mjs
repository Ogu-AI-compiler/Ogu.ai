/**
 * Command Bus — route commands to registered handlers.
 */
export function createCommandBus() {
  const handlers = new Map();
  const middleware = [];
  function register(command, handler) { handlers.set(command, handler); }
  function unregister(command) { handlers.delete(command); }
  function use(mw) { middleware.push(mw); }
  function dispatch(command, payload) {
    let ctx = { command, payload };
    for (const mw of middleware) ctx = mw(ctx) || ctx;
    const handler = handlers.get(ctx.command);
    if (!handler) throw new Error(`No handler for command: ${ctx.command}`);
    return handler(ctx.payload);
  }
  function listCommands() { return [...handlers.keys()]; }
  return { register, unregister, use, dispatch, listCommands };
}
