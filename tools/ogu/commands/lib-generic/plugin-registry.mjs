/**
 * Plugin Registry — register, retrieve, and manage plugins.
 */
export function createPluginRegistry() {
  const plugins = new Map();
  function register(name, plugin) { plugins.set(name, plugin); }
  function unregister(name) { plugins.delete(name); }
  function get(name) { return plugins.get(name) || null; }
  function list() { return [...plugins.keys()]; }
  function has(name) { return plugins.has(name); }
  return { register, unregister, get, list, has };
}
