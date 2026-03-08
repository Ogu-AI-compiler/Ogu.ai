/**
 * CQRS Handler — Command Query Responsibility Segregation.
 */
export function createCQRSHandler() {
  const commands = new Map();
  const queries = new Map();
  function registerCommand(name, handler) { commands.set(name, handler); }
  function registerQuery(name, handler) { queries.set(name, handler); }
  function executeCommand(name, data) {
    const h = commands.get(name);
    if (!h) throw new Error(`Unknown command: ${name}`);
    return h(data);
  }
  function executeQuery(name, params) {
    const h = queries.get(name);
    if (!h) throw new Error(`Unknown query: ${name}`);
    return h(params);
  }
  return { registerCommand, registerQuery, executeCommand, executeQuery };
}
