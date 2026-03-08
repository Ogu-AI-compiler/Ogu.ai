/**
 * Process Manager — manage simulated processes.
 */
export function createProcessManager() {
  const processes = new Map();
  let nextPid = 1;

  function spawn(name, options = {}) {
    const pid = nextPid++;
    processes.set(pid, { pid, name, status: "running", startedAt: Date.now(), ...options });
    return pid;
  }

  function kill(pid) {
    processes.delete(pid);
  }

  function getStatus(pid) {
    return processes.get(pid) || null;
  }

  function list() {
    return [...processes.values()];
  }

  return { spawn, kill, getStatus, list };
}
