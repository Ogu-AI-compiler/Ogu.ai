/**
 * Heartbeat Monitor — track service heartbeats and detect failures.
 */
export function createHeartbeatMonitor(timeoutMs = 5000) {
  const services = new Map();
  function register(name) { services.set(name, { lastBeat: 0, alive: false }); }
  function beat(name, now = Date.now()) {
    const svc = services.get(name);
    if (svc) { svc.lastBeat = now; svc.alive = true; }
  }
  function check(now = Date.now()) {
    const results = {};
    for (const [name, svc] of services) {
      const alive = svc.alive && (now - svc.lastBeat < timeoutMs);
      svc.alive = alive;
      results[name] = alive;
    }
    return results;
  }
  function isAlive(name, now = Date.now()) {
    const svc = services.get(name);
    if (!svc) return false;
    return svc.alive && (now - svc.lastBeat < timeoutMs);
  }
  function list() { return [...services.keys()]; }
  return { register, beat, check, isAlive, list };
}
