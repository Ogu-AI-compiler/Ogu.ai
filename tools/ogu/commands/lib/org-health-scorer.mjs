/**
 * org-health-scorer.mjs — Computes weighted organization health score.
 */
export function computeOrgHealth({ gatePassRate = 1, agentPerformance = 1, budgetAdherence = 1, driftLevel = 0 } = {}) {
  const overall = (
    gatePassRate      * 0.35 +
    agentPerformance  * 0.30 +
    budgetAdherence   * 0.20 +
    (1 - driftLevel)  * 0.15
  );
  return {
    overall: Math.max(0, Math.min(1, overall)),
    level: overall >= 0.8 ? 'healthy' : overall >= 0.6 ? 'degraded' : 'critical',
    components: { gatePassRate, agentPerformance, budgetAdherence, driftLevel },
  };
}

export function getHealthLevel(score) {
  if (score >= 0.8) return 'healthy';
  if (score >= 0.6) return 'degraded';
  return 'critical';
}
