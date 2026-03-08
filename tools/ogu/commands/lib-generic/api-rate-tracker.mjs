/**
 * API Rate Tracker — track API usage rates per client.
 */
export function createAPIRateTracker() {
  const usage = new Map();
  function record(clientId, endpoint, now = Date.now()) {
    const key = `${clientId}:${endpoint}`;
    if (!usage.has(key)) usage.set(key, []);
    usage.get(key).push(now);
  }
  function getRate(clientId, endpoint, windowMs = 60000, now = Date.now()) {
    const key = `${clientId}:${endpoint}`;
    const times = (usage.get(key) || []).filter(t => now - t < windowMs);
    return times.length;
  }
  function getTopClients(endpoint, windowMs = 60000, now = Date.now()) {
    const counts = {};
    for (const [key, times] of usage) {
      if (key.endsWith(`:${endpoint}`)) {
        const clientId = key.split(':')[0];
        counts[clientId] = times.filter(t => now - t < windowMs).length;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }));
  }
  function reset() { usage.clear(); }
  return { record, getRate, getTopClients, reset };
}
