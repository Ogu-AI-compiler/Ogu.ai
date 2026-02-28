/**
 * Runner Pool — manage pool of runners (local and remote).
 */

/**
 * Create a runner pool.
 *
 * @returns {object} Pool with addRunner/acquire/release/listRunners/getPoolStatus
 */
export function createRunnerPool() {
  const runners = new Map(); // runnerId → { type, maxConcurrent, endpoint, activeTasks: Set }
  const taskToRunner = new Map(); // taskId → runnerId

  function addRunner(runnerId, { type = 'local', maxConcurrent = 1, endpoint }) {
    runners.set(runnerId, {
      runnerId,
      type,
      maxConcurrent,
      endpoint: endpoint || null,
      activeTasks: new Set(),
    });
  }

  function listRunners() {
    return Array.from(runners.values()).map(r => ({
      runnerId: r.runnerId,
      type: r.type,
      maxConcurrent: r.maxConcurrent,
      activeTasks: r.activeTasks.size,
    }));
  }

  function acquire(taskId) {
    // Find first available runner
    for (const runner of runners.values()) {
      if (runner.activeTasks.size < runner.maxConcurrent) {
        runner.activeTasks.add(taskId);
        taskToRunner.set(taskId, runner.runnerId);
        return { runnerId: runner.runnerId, type: runner.type, endpoint: runner.endpoint };
      }
    }
    return null;
  }

  function release(taskId) {
    const runnerId = taskToRunner.get(taskId);
    if (!runnerId) return false;
    const runner = runners.get(runnerId);
    if (runner) runner.activeTasks.delete(taskId);
    taskToRunner.delete(taskId);
    return true;
  }

  function getPoolStatus() {
    let totalCapacity = 0;
    let activeJobs = 0;
    for (const runner of runners.values()) {
      totalCapacity += runner.maxConcurrent;
      activeJobs += runner.activeTasks.size;
    }
    return {
      totalRunners: runners.size,
      totalCapacity,
      activeJobs,
      available: totalCapacity - activeJobs,
    };
  }

  return { addRunner, acquire, release, listRunners, getPoolStatus };
}
