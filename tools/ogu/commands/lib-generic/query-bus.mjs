/**
 * Query Bus — route queries to registered handlers.
 */
export function createQueryBus() {
  const handlers = new Map();
  function register(query, handler) { handlers.set(query, handler); }
  function unregister(query) { handlers.delete(query); }
  function execute(query, params) {
    const handler = handlers.get(query);
    if (!handler) throw new Error(`No handler for query: ${query}`);
    return handler(params);
  }
  function listQueries() { return [...handlers.keys()]; }
  return { register, unregister, execute, listQueries };
}
