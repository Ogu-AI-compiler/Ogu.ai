/**
 * Graceful Shutdown — clean shutdown with drain, hook execution, signal handling.
 */

export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT', 'SIGHUP'];

/**
 * Create a shutdown manager that executes hooks in reverse registration order.
 *
 * @returns {object} Manager with register/shutdown/isShuttingDown/listHooks
 */
export function createShutdownManager() {
  const hooks = []; // { name, fn }
  let shuttingDown = false;

  function register(name, fn) {
    hooks.push({ name, fn });
  }

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    // Execute hooks in reverse order (LIFO)
    for (let i = hooks.length - 1; i >= 0; i--) {
      try {
        await hooks[i].fn();
      } catch (_) {
        // Swallow errors during shutdown
      }
    }
  }

  function isShuttingDown() {
    return shuttingDown;
  }

  function listHooks() {
    return hooks.map(h => h.name);
  }

  return { register, shutdown, isShuttingDown, listHooks };
}
