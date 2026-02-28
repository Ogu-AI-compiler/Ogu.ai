/**
 * Task Dependency Resolver — topological sort, cycle detection, critical path.
 *
 * Takes task arrays with { id, deps, duration? } and provides:
 * - topoSort: ordered execution list
 * - findCriticalPath: longest weighted path
 * - getExecutionWaves: groups of parallelizable tasks
 */

/**
 * Topological sort using Kahn's algorithm.
 * Throws if a cycle is detected.
 *
 * @param {{ id: string, deps: string[] }[]} tasks
 * @returns {string[]} Task IDs in execution order
 */
export function topoSort(tasks) {
  const inDegree = new Map();
  const adj = new Map();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const t of tasks) {
    for (const dep of t.deps) {
      if (adj.has(dep)) {
        adj.get(dep).push(t.id);
        inDegree.set(t.id, inDegree.get(t.id) + 1);
      }
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result = [];
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    for (const neighbor of adj.get(node)) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (result.length !== tasks.length) {
    throw new Error('Cycle detected in task dependencies');
  }

  return result;
}

/**
 * Find the critical path (longest weighted path) through the task graph.
 *
 * @param {{ id: string, deps: string[], duration: number }[]} tasks
 * @returns {{ path: string[], totalDuration: number }}
 */
export function findCriticalPath(tasks) {
  const order = topoSort(tasks);
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const dist = new Map();
  const prev = new Map();

  for (const id of order) {
    dist.set(id, 0);
    prev.set(id, null);
  }

  for (const id of order) {
    const task = taskMap.get(id);
    const currentDist = dist.get(id) + (task.duration || 0);

    for (const other of tasks) {
      if (other.deps.includes(id)) {
        if (currentDist > dist.get(other.id)) {
          dist.set(other.id, currentDist);
          prev.set(other.id, id);
        }
      }
    }
  }

  // Find the end node with max distance + its own duration
  let maxEnd = null;
  let maxTotal = 0;
  for (const t of tasks) {
    const total = dist.get(t.id) + (t.duration || 0);
    if (total > maxTotal) {
      maxTotal = total;
      maxEnd = t.id;
    }
  }

  // Reconstruct path
  const path = [];
  let current = maxEnd;
  while (current) {
    path.unshift(current);
    current = prev.get(current);
  }

  return { path, totalDuration: maxTotal };
}

/**
 * Group tasks into execution waves (parallelizable groups).
 *
 * @param {{ id: string, deps: string[] }[]} tasks
 * @returns {string[][]} Array of waves, each wave is array of task IDs
 */
export function getExecutionWaves(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const completed = new Set();
  const waves = [];

  while (completed.size < tasks.length) {
    const wave = [];
    for (const t of tasks) {
      if (completed.has(t.id)) continue;
      if (t.deps.every(d => completed.has(d))) {
        wave.push(t.id);
      }
    }
    if (wave.length === 0) {
      throw new Error('Cycle detected: no tasks ready to execute');
    }
    waves.push(wave);
    for (const id of wave) completed.add(id);
  }

  return waves;
}
