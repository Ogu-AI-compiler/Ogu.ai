/**
 * Wave Executor — execute tasks in parallel waves from a DAG.
 */

/**
 * Create a wave executor.
 *
 * @returns {object} Executor with addTask/execute/listTasks
 */
export function createWaveExecutor() {
  const tasks = new Map(); // id → { run, deps }

  function addTask(id, { run, deps = [] }) {
    tasks.set(id, { id, run, deps });
  }

  function listTasks() {
    return Array.from(tasks.keys());
  }

  /**
   * Build waves — each wave contains tasks whose deps are all in prior waves.
   */
  function buildWaves() {
    const waves = [];
    const completed = new Set();
    const remaining = new Map(tasks);

    while (remaining.size > 0) {
      const wave = [];
      for (const [id, task] of remaining) {
        if (task.deps.every(d => completed.has(d))) {
          wave.push(id);
        }
      }
      if (wave.length === 0) {
        throw new Error('Circular dependency detected');
      }
      for (const id of wave) {
        remaining.delete(id);
        completed.add(id);
      }
      waves.push(wave);
    }
    return waves;
  }

  async function execute() {
    const waves = buildWaves();
    const results = {};
    const errors = {};
    let failed = false;

    for (const wave of waves) {
      if (failed) break;

      const promises = wave.map(async (id) => {
        const task = tasks.get(id);
        try {
          const result = await task.run();
          results[id] = result;
          return { id, ok: true };
        } catch (e) {
          errors[id] = e.message;
          return { id, ok: false };
        }
      });

      const waveResults = await Promise.all(promises);
      for (const wr of waveResults) {
        if (!wr.ok) failed = true;
      }
    }

    return {
      status: failed ? 'failed' : 'completed',
      waves,
      results,
      errors,
    };
  }

  return { addTask, execute, listTasks };
}
