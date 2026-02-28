/**
 * Host Registry — register and lookup hosts.
 */
export function createHostRegistry() {
  const hosts = new Map();

  function register(name, info) {
    hosts.set(name, { name, ...info, registeredAt: Date.now() });
  }

  function deregister(name) {
    hosts.delete(name);
  }

  function lookup(name) {
    return hosts.get(name) || null;
  }

  function listHosts() {
    return [...hosts.values()];
  }

  function getStats() {
    return { total: hosts.size };
  }

  return { register, deregister, lookup, listHosts, getStats };
}
