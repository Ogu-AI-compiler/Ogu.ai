/**
 * Sandbox Isolator — run code in isolated sandbox environments.
 */
export function createSandboxIsolator() {
  const sandboxes = new Map();
  let nextId = 1;
  function create(name, opts = {}) {
    const id = nextId++;
    const sb = { id, name, env: { ...(opts.env || {}) }, log: [], running: false };
    sandboxes.set(id, sb);
    return id;
  }
  function run(id, fn) {
    const sb = sandboxes.get(id);
    if (!sb) throw new Error(`Sandbox ${id} not found`);
    sb.running = true;
    try {
      const result = fn(sb.env);
      sb.log.push({ action: 'run', result });
      return result;
    } finally {
      sb.running = false;
    }
  }
  function destroy(id) {
    sandboxes.delete(id);
  }
  function list() { return [...sandboxes.values()].map(s => ({ id: s.id, name: s.name, running: s.running })); }
  function getLog(id) { const sb = sandboxes.get(id); return sb ? sb.log : []; }
  return { create, run, destroy, list, getLog };
}
