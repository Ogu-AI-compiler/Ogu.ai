/**
 * Command History — track and search command history.
 */
export function createCommandHistory(maxSize = 1000) {
  const history = [];

  function add(command) {
    history.push(command);
    if (history.length > maxSize) history.shift();
  }

  function list() {
    return [...history];
  }

  function search(query) {
    return history.filter(cmd => cmd.includes(query));
  }

  function getLast() {
    return history.length > 0 ? history[history.length - 1] : null;
  }

  function clear() {
    history.length = 0;
  }

  return { add, list, search, getLast, clear };
}
