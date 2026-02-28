/**
 * DAG Builder — builds a Directed Acyclic Graph from tasks with dependencies.
 *
 * Input: Array of { taskId, blockedBy: string[] }
 * Output: { valid, waves, error? }
 *
 * Waves: Groups of tasks that can execute in parallel.
 *   Wave 0 = all roots (no blockers)
 *   Wave 1 = tasks whose blockers are all in Wave 0
 *   etc.
 */

/**
 * Build a DAG and compute execution waves.
 * @param {Array<{taskId: string, blockedBy: string[]}>} tasks
 * @returns {{ valid: boolean, waves: string[][], taskCount: number, error?: string }}
 */
export function buildDAG(tasks) {
  const taskMap = new Map();
  for (const t of tasks) {
    taskMap.set(t.taskId, { ...t, blockedBy: [...(t.blockedBy || [])] });
  }

  // Validate: all blockedBy references exist
  for (const t of tasks) {
    for (const dep of (t.blockedBy || [])) {
      if (!taskMap.has(dep)) {
        return {
          valid: false,
          waves: [],
          taskCount: tasks.length,
          error: `Task "${t.taskId}" depends on unknown task "${dep}"`,
        };
      }
    }
  }

  // Detect cycles using Kahn's algorithm (topological sort)
  const inDegree = new Map();
  const dependents = new Map(); // dep → tasks that depend on it

  for (const t of tasks) {
    if (!inDegree.has(t.taskId)) inDegree.set(t.taskId, 0);
    if (!dependents.has(t.taskId)) dependents.set(t.taskId, []);

    for (const dep of (t.blockedBy || [])) {
      inDegree.set(t.taskId, (inDegree.get(t.taskId) || 0) + 1);
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep).push(t.taskId);
    }
  }

  // Fix: ensure roots start at 0
  for (const t of tasks) {
    if (!t.blockedBy || t.blockedBy.length === 0) {
      inDegree.set(t.taskId, 0);
    }
  }

  // Kahn's: process in waves
  const waves = [];
  const resolved = new Set();
  let remaining = new Set(tasks.map(t => t.taskId));

  while (remaining.size > 0) {
    // Find all tasks with inDegree 0 among remaining
    const wave = [];
    for (const id of remaining) {
      if ((inDegree.get(id) || 0) === 0) {
        wave.push(id);
      }
    }

    if (wave.length === 0) {
      // No progress = cycle
      return {
        valid: false,
        waves,
        taskCount: tasks.length,
        error: `Cycle detected among tasks: ${[...remaining].join(', ')}`,
      };
    }

    waves.push(wave.sort()); // Sort for deterministic output

    for (const id of wave) {
      remaining.delete(id);
      resolved.add(id);
      for (const dependent of (dependents.get(id) || [])) {
        inDegree.set(dependent, inDegree.get(dependent) - 1);
      }
    }
  }

  return {
    valid: true,
    waves,
    taskCount: tasks.length,
  };
}

/**
 * Parse CLI dependency notation.
 * Format: "taskC:taskA+taskB,taskD:taskC"
 * Returns: Map<taskId, string[]>
 */
export function parseDeps(depsStr) {
  const result = new Map();
  if (!depsStr) return result;

  for (const part of depsStr.split(',')) {
    const [taskId, depsRaw] = part.split(':');
    if (taskId && depsRaw) {
      result.set(taskId.trim(), depsRaw.split('+').map(d => d.trim()));
    }
  }
  return result;
}
