/**
 * Process Spawner — spawn and manage lightweight processes.
 */
export function createProcessSpawner() {
  const processes = new Map();
  let nextPid = 1;
  function spawn(name, fn) {
    const pid = nextPid++;
    processes.set(pid, { pid, name, fn, status: 'ready', result: null });
    return pid;
  }
  function run(pid) {
    const proc = processes.get(pid);
    if (!proc) throw new Error(`Process ${pid} not found`);
    proc.status = 'running';
    try {
      proc.result = proc.fn();
      proc.status = 'done';
      return proc.result;
    } catch (e) {
      proc.status = 'error';
      proc.result = e.message;
      throw e;
    }
  }
  function kill(pid) {
    const proc = processes.get(pid);
    if (proc) proc.status = 'killed';
  }
  function getStatus(pid) { const p = processes.get(pid); return p ? p.status : null; }
  function list() { return [...processes.values()].map(p => ({ pid: p.pid, name: p.name, status: p.status })); }
  return { spawn, run, kill, getStatus, list };
}
