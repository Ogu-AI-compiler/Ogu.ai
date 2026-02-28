/**
 * Health Score Aggregator — composite org health metric from multiple signals.
 */

/**
 * Compute a composite health score from multiple signals.
 *
 * @param {{ tasksCompleted: number, tasksTotal: number, budgetEfficiency: number, errorRate: number, determinismScore: number }} signals
 * @returns {number} Score 0-100
 */
export function computeHealthScore({ tasksCompleted, tasksTotal, budgetEfficiency, errorRate, determinismScore }) {
  const completionRate = tasksTotal > 0 ? tasksCompleted / tasksTotal : 0;
  const errorInverse = 1 - Math.min(errorRate, 1);
  const detNorm = Math.min(determinismScore, 100) / 100;

  // Weighted average
  const score =
    completionRate * 30 +
    budgetEfficiency * 25 +
    errorInverse * 25 +
    detNorm * 20;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Map a health score to a named level.
 *
 * @param {number} score
 * @returns {string} 'healthy' | 'degraded' | 'critical'
 */
export function getHealthLevel(score) {
  if (score >= 80) return 'healthy';
  if (score >= 40) return 'degraded';
  return 'critical';
}
