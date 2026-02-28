/**
 * Health Check Runner — run health checks and report status.
 */
export function createHealthCheckRunner() {
  const checks = [];

  function addCheck({ name, check }) {
    checks.push({ name, check });
  }

  async function runAll() {
    const results = [];
    for (const c of checks) {
      try {
        const result = await c.check();
        results.push({ name: c.name, ...result });
      } catch (err) {
        results.push({ name: c.name, healthy: false, error: err.message });
      }
    }
    return results;
  }

  async function isHealthy() {
    const results = await runAll();
    return results.every(r => r.healthy);
  }

  return { addCheck, runAll, isHealthy };
}
