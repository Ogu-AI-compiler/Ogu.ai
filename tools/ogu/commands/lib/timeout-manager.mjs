/**
 * timeout-manager.mjs — Named timeout tracking with cancellation.
 */
export function createTimeoutManager() {
  const timers = new Map();

  return {
    setTimeout(name, ms, callback) {
      this.clearTimeout(name);
      const id = setTimeout(() => {
        timers.delete(name);
        callback?.();
      }, ms);
      timers.set(name, id);
      return id;
    },

    clearTimeout(name) {
      const id = timers.get(name);
      if (id !== undefined) { clearTimeout(id); timers.delete(name); }
    },

    clearAll() {
      for (const id of timers.values()) clearTimeout(id);
      timers.clear();
    },

    has(name) { return timers.has(name); },
    list() { return [...timers.keys()]; },
  };
}
