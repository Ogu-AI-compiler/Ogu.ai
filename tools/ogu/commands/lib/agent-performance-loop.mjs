/**
 * Agent Performance Loop — closed-loop tracking and model selection improvement.
 *
 * Records task outcomes per agent/model/taskType, computes stats,
 * and recommends best model based on success rate.
 */

/**
 * Create a performance loop.
 *
 * @returns {object} Loop with recordOutcome/getStats/recommend
 */
export function createPerformanceLoop() {
  const outcomes = [];

  function recordOutcome({ agentId, taskType, model, success, duration, cost }) {
    outcomes.push({ agentId, taskType, model, success, duration, cost, timestamp: Date.now() });
  }

  function getStats(agentId) {
    const filtered = agentId ? outcomes.filter(o => o.agentId === agentId) : outcomes;
    const total = filtered.length;
    const successes = filtered.filter(o => o.success).length;
    const failures = total - successes;
    const avgDuration = total > 0
      ? filtered.reduce((sum, o) => sum + o.duration, 0) / total
      : 0;
    const totalCost = filtered.reduce((sum, o) => sum + o.cost, 0);
    const successRate = total > 0 ? successes / total : 0;

    return { total, successes, failures, successRate, avgDuration, totalCost };
  }

  function recommend({ taskType }) {
    const relevant = outcomes.filter(o => o.taskType === taskType);
    if (relevant.length === 0) return { model: 'sonnet', confidence: 0, reason: 'no data' };

    // Group by model
    const modelStats = new Map();
    for (const o of relevant) {
      if (!modelStats.has(o.model)) modelStats.set(o.model, { successes: 0, total: 0 });
      const s = modelStats.get(o.model);
      s.total++;
      if (o.success) s.successes++;
    }

    // Pick model with highest success rate
    let bestModel = null;
    let bestRate = -1;
    for (const [model, stats] of modelStats) {
      const rate = stats.total > 0 ? stats.successes / stats.total : 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestModel = model;
      }
    }

    return {
      model: bestModel,
      confidence: bestRate,
      reason: `${bestRate * 100}% success rate over ${modelStats.get(bestModel).total} tasks`,
    };
  }

  return { recordOutcome, getStats, recommend };
}
