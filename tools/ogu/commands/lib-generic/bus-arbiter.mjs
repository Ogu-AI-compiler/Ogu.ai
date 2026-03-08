/**
 * Bus Arbiter — priority-based bus arbitration.
 */
export function createBusArbiter() {
  const devices = new Map();
  const requests = new Set();
  let currentOwner = null;
  function addDevice(name, priority) { devices.set(name, priority); }
  function request(name) { requests.add(name); }
  function arbitrate() {
    let best = null, bestPri = -1;
    for (const name of requests) {
      const pri = devices.get(name) || 0;
      if (pri > bestPri) { bestPri = pri; best = name; }
    }
    if (best) { currentOwner = best; requests.clear(); }
    return best;
  }
  function release(name) { if (currentOwner === name) currentOwner = null; }
  function getCurrentOwner() { return currentOwner; }
  return { addDevice, request, arbitrate, release, getCurrentOwner };
}
