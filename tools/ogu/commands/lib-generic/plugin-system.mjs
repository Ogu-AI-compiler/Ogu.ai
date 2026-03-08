/**
 * Plugin System — load, register, and execute plugins with lifecycle hooks.
 */

export const PLUGIN_HOOKS = [
  'build:before', 'build:after',
  'compile:before', 'compile:after',
  'gate:before', 'gate:after',
  'deploy:before', 'deploy:after',
];

/**
 * Create a plugin manager instance.
 * @returns {object} Manager with register/unregister/execute/listPlugins
 */
export function createPluginManager() {
  const plugins = new Map();

  function register(plugin) {
    plugins.set(plugin.id, plugin);
  }

  function unregister(pluginId) {
    plugins.delete(pluginId);
  }

  function execute(hookName, context) {
    const results = [];
    for (const plugin of plugins.values()) {
      const hook = plugin.hooks?.[hookName];
      if (typeof hook === 'function') {
        results.push({ pluginId: plugin.id, result: hook(context) });
      }
    }
    return results;
  }

  function listPlugins() {
    return [...plugins.values()].map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      hooks: Object.keys(p.hooks || {}),
    }));
  }

  return { register, unregister, execute, listPlugins };
}

/**
 * Create a plugin system with init lifecycle and disable support.
 */
export function createPluginSystem() {
  const plugins = new Map();
  const disabled = new Set();

  function register({ name, version, init, hooks }) {
    plugins.set(name, { name, version, init, hooks, initialized: false });
  }

  function disable(name) {
    disabled.add(name);
  }

  function enable(name) {
    disabled.delete(name);
  }

  function initialize() {
    for (const [name, plugin] of plugins) {
      if (disabled.has(name)) continue;
      if (plugin.initialized) continue;
      if (plugin.init) plugin.init();
      plugin.initialized = true;
    }
  }

  function listPluginsExt() {
    return Array.from(plugins.values()).map(({ name, version, initialized }) => ({
      name, version, initialized, disabled: disabled.has(name),
    }));
  }

  function getPlugin(name) {
    return plugins.get(name) || null;
  }

  return { register, disable, enable, initialize, listPlugins: listPluginsExt, getPlugin };
}
