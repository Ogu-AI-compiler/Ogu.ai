/**
 * health-probe.mjs — Runs a health probe against a URL or check function.
 */
export async function runHealthProbe({ url, checkFn, timeoutMs = 5000 } = {}) {
  const start = Date.now();
  try {
    if (typeof checkFn === 'function') {
      const result = await Promise.race([
        checkFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);
      return { healthy: true, latencyMs: Date.now() - start, result };
    }
    if (url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      return { healthy: res.ok, status: res.status, latencyMs: Date.now() - start };
    }
    return { healthy: true, latencyMs: 0 };
  } catch (err) {
    return { healthy: false, error: err.message, latencyMs: Date.now() - start };
  }
}
