/**
 * Org Health Scorer — weighted health score from gates, agents, budget, drift.
 */

export const HEALTH_WEIGHTS = {
  gatePassRate: 0.35,
  agentPerformance: 0.25,
  budgetAdherence: 0.20,
  driftLevel: 0.20,
};

/**
 * Compute org health score from multiple signals.
 *
 * @param {{ gatePassRate: number, agentPerformance: number, budgetAdherence: number, driftLevel: number }} metrics
 * @returns {{ overall: number, breakdown: object, level: string }}
 */
export function computeOrgHealth({ gatePassRate = 1, agentPerformance = 1, budgetAdherence = 1, driftLevel = 0 }) {
  // driftLevel is inverted: 0 drift = perfect, 1 drift = worst
  const driftScore = 1 - Math.min(driftLevel, 1);

  const breakdown = {
    gatePassRate: { value: gatePassRate, weight: HEALTH_WEIGHTS.gatePassRate, weighted: gatePassRate * HEALTH_WEIGHTS.gatePassRate },
    agentPerformance: { value: agentPerformance, weight: HEALTH_WEIGHTS.agentPerformance, weighted: agentPerformance * HEALTH_WEIGHTS.agentPerformance },
    budgetAdherence: { value: budgetAdherence, weight: HEALTH_WEIGHTS.budgetAdherence, weighted: budgetAdherence * HEALTH_WEIGHTS.budgetAdherence },
    driftLevel: { value: driftScore, weight: HEALTH_WEIGHTS.driftLevel, weighted: driftScore * HEALTH_WEIGHTS.driftLevel },
  };

  const overall = breakdown.gatePassRate.weighted +
    breakdown.agentPerformance.weighted +
    breakdown.budgetAdherence.weighted +
    breakdown.driftLevel.weighted;

  return {
    overall: Math.max(0, Math.min(1, overall)),
    breakdown,
    level: getHealthLevel(overall),
  };
}

/**
 * Get health level string from score.
 */
export function getHealthLevel(score) {
  if (score >= 0.85) return 'excellent';
  if (score >= 0.65) return 'good';
  if (score >= 0.40) return 'degraded';
  return 'critical';
}
