/**
 * graceful-shutdown.mjs — Graceful process shutdown with ordered teardown.
 */
export function createShutdownManager() {
  const hooks = [];
  let shutdownInProgress = false;

  return {
    register(name, fn, { priority = 50 } = {}) {
      hooks.push({ name, fn, priority });
      hooks.sort((a, b) => a.priority - b.priority);
    },

    addHook(name, fn, opts) { return this.register(name, fn, opts); },

    async shutdown(signal = 'SIGTERM') {
      if (shutdownInProgress) return;
      shutdownInProgress = true;
      for (const hook of hooks) {
        try { await hook.fn(signal); } catch { /* best-effort */ }
      }
    },

    isShuttingDown() { return shutdownInProgress; },
  };
}
