/**
 * Progress Tracker — track multi-step progress with percentage.
 */

/**
 * Create a progress tracker.
 *
 * @param {{ total: number }} opts
 * @returns {object} Tracker with increment/getProgress/isComplete
 */
export function createProgressTracker({ total }) {
  let completed = 0;

  function increment(amount = 1) {
    completed = Math.min(completed + amount, total);
  }

  function getProgress() {
    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
      remaining: total - completed,
    };
  }

  function isComplete() {
    return completed >= total;
  }

  return { increment, getProgress, isComplete };
}
