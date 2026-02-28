/**
 * Task Prioritizer — score and rank tasks by urgency, impact, dependencies.
 *
 * Tasks with dependencies (blockedBy) are penalized. Higher urgency + impact
 * yields higher scores.
 */

const BLOCKED_PENALTY = 100;

/**
 * Score a single task.
 *
 * @param {object} task - { urgency, impact, blockedBy }
 * @returns {number} Priority score (higher = more important)
 */
export function scoreTask({ urgency, impact, blockedBy }) {
  const base = urgency * 2 + impact * 3;
  const penalty = (blockedBy && blockedBy.length > 0) ? BLOCKED_PENALTY : 0;
  return base - penalty;
}

/**
 * Prioritize a list of tasks, highest priority first.
 *
 * @param {Array} tasks - Array of { id, urgency, impact, blockedBy }
 * @returns {Array} Sorted tasks with computed scores
 */
export function prioritizeTasks(tasks) {
  return tasks
    .map(task => ({
      ...task,
      score: scoreTask(task),
    }))
    .sort((a, b) => b.score - a.score);
}
