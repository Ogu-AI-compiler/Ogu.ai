/**
 * Health Checker — run health checks on services.
 */
export function createHealthChecker() {
  const checks = new Map();
  function register(name, checkFn) { checks.set(name, checkFn); }
  function unregister(name) { checks.delete(name); }
  function run() {
    const results = {};
    for (const [name, fn] of checks) {
      try {
        const ok = fn();
        results[name] = { healthy: !!ok, error: null };
      } catch (e) {
        results[name] = { healthy: false, error: e.message };
      }
    }
    const allHealthy = Object.values(results).every(r => r.healthy);
    return { healthy: allHealthy, checks: results };
  }
  function list() { return [...checks.keys()]; }
  return { register, unregister, run, list };
}
