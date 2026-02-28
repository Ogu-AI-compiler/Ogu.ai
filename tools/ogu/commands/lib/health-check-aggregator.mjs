/**
 * Health Check Aggregator — aggregate health from all subsystems.
 */

/**
 * Create a health check aggregator.
 *
 * @returns {object} Aggregator with addCheck/runAll/listChecks
 */
export function createHealthAggregator() {
  const checks = []; // { name, fn }

  function addCheck(name, fn) {
    checks.push({ name, fn });
  }

  function listChecks() {
    return checks.map(c => c.name);
  }

  async function runAll() {
    const results = [];
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const check of checks) {
      try {
        const result = await check.fn();
        const status = result.status || 'healthy';
        results.push({ name: check.name, status });
        if (status === 'degraded') hasDegraded = true;
        if (status === 'unhealthy') hasUnhealthy = true;
      } catch (e) {
        results.push({ name: check.name, status: 'unhealthy', error: e.message });
        hasUnhealthy = true;
      }
    }

    let overall = 'healthy';
    if (hasDegraded) overall = 'degraded';
    if (hasUnhealthy) overall = 'unhealthy';

    return {
      overall,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  return { addCheck, runAll, listChecks };
}
