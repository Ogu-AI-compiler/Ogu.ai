/**
 * Cron Executor — schedule and execute cron-based tasks.
 */
export function createCronExecutor() {
  const jobs = new Map();
  let nextId = 1;
  function schedule(name, cronExpr, handler) {
    const id = nextId++;
    jobs.set(id, { id, name, cronExpr, handler, enabled: true, runs: 0 });
    return id;
  }
  function execute(id) {
    const job = jobs.get(id);
    if (!job || !job.enabled) return null;
    job.runs++;
    return job.handler();
  }
  function enable(id) { const j = jobs.get(id); if (j) j.enabled = true; }
  function disable(id) { const j = jobs.get(id); if (j) j.enabled = false; }
  function remove(id) { jobs.delete(id); }
  function list() { return [...jobs.values()].map(j => ({ id: j.id, name: j.name, enabled: j.enabled, runs: j.runs })); }
  return { schedule, execute, enable, disable, remove, list };
}
