/**
 * health-dashboard.mjs — Aggregates system health into a dashboard snapshot.
 */
export async function checkSystemHealth({ checks = {}, timeoutMs = 5000 } = {}) {
  const results = {};
  for (const [name, checkFn] of Object.entries(checks)) {
    const start = Date.now();
    try {
      const result = await Promise.race([
        typeof checkFn === 'function' ? checkFn() : Promise.resolve(checkFn),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), timeoutMs)),
      ]);
      results[name] = { status: 'healthy', latencyMs: Date.now() - start, ...result };
    } catch (err) {
      results[name] = { status: 'unhealthy', error: err.message, latencyMs: Date.now() - start };
    }
  }
  const statuses = Object.values(results).map(r => r.status);
  const overall = statuses.every(s => s === 'healthy') ? 'healthy'
    : statuses.some(s => s === 'unhealthy') ? 'unhealthy' : 'degraded';
  return { overall, checks: results, timestamp: new Date().toISOString() };
}
