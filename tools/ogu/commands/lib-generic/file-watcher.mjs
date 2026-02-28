/**
 * File Watcher — watch files for changes (simulated).
 */
export function createFileWatcher() {
  const watchers = new Map();
  let nextId = 1;
  function watch(path, callback) {
    const id = nextId++;
    watchers.set(id, { path, callback, active: true });
    return id;
  }
  function unwatch(id) { watchers.delete(id); }
  function simulate(path, event) {
    for (const [, w] of watchers) {
      if (w.active && w.path === path) w.callback({ path, event });
    }
  }
  function list() { return [...watchers.values()].map(w => ({ path: w.path, active: w.active })); }
  function count() { return watchers.size; }
  return { watch, unwatch, simulate, list, count };
}
