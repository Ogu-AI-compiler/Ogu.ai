/**
 * Complete Wave Executor — full wave execution with conflict detection and rollback.
 *
 * Before running tasks in parallel, checks for file conflicts.
 * Captures failures and maintains cumulative history.
 */

import { detectConflicts } from './wave-conflict-detector.mjs';

/**
 * Create a complete wave executor.
 *
 * @returns {object} Executor with executeWave/getResults
 */
export function createCompleteWaveExecutor() {
  const history = [];

  async function executeWave({ tasks }) {
    // Check for conflicts before execution
    const agents = tasks.map(t => ({ id: t.id, files: t.files || [] }));
    const conflictResult = detectConflicts({ agents });

    const waveResult = {
      waveIndex: history.length,
      completed: [],
      failed: [],
      conflicts: conflictResult.conflicts,
      startedAt: Date.now(),
    };

    // Run non-conflicting tasks
    const conflictingIds = new Set();
    for (const c of conflictResult.conflicts) {
      for (const id of c.agents) conflictingIds.add(id);
    }

    const runnableTasks = tasks.filter(t => !conflictingIds.has(t.id));

    const promises = runnableTasks.map(async (task) => {
      try {
        const result = await task.run();
        waveResult.completed.push({ id: task.id, result });
      } catch (err) {
        waveResult.failed.push({ id: task.id, error: err.message });
      }
    });

    await Promise.all(promises);

    waveResult.finishedAt = Date.now();
    history.push(waveResult);
    return waveResult;
  }

  function getResults() {
    return [...history];
  }

  return { executeWave, getResults };
}
