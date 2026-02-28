/**
 * Cache Coherence Protocol — simplified MESI protocol.
 */
export function createCacheCoherence() {
  const states = new Map(); // key: `${addr}:${cpu}` -> state
  function key(addr, cpu) { return `${addr}:${cpu}`; }
  function allCpusForAddr(addr) {
    const cpus = [];
    for (const [k] of states) { if (k.startsWith(`${addr}:`)) cpus.push(k.split(":")[1]); }
    return cpus;
  }
  function read(addr, cpu) {
    states.set(key(addr, cpu), "shared");
  }
  function write(addr, cpu) {
    states.set(key(addr, cpu), "modified");
    for (const other of allCpusForAddr(addr)) {
      if (other !== cpu) states.set(key(addr, other), "invalid");
    }
  }
  function getState(addr, cpu) { return states.get(key(addr, cpu)) || "invalid"; }
  return { read, write, getState };
}
