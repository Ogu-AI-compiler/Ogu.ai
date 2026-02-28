/**
 * Hot Reload Manager — register and trigger module hot reloads.
 */
export function createHotReloadManager() {
  const modules = new Map();
  const counts = new Map();

  function register(name, reloadFn) {
    modules.set(name, reloadFn);
    counts.set(name, 0);
  }

  function triggerReload(name) {
    const fn = modules.get(name);
    if (fn) { fn(); counts.set(name, (counts.get(name) || 0) + 1); }
  }

  function getReloadCount(name) { return counts.get(name) || 0; }

  return { register, triggerReload, getReloadCount };
}
