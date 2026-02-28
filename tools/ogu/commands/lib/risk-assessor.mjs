/**
 * Risk Assessor — assess risk level of operations for governance.
 */

export const RISK_TIERS = ['low', 'medium', 'high', 'critical'];

const HIGH_RISK_PATTERNS = [
  /db\//i, /schema/i, /migration/i, /\.env/i, /secret/i,
  /deploy/i, /infra/i, /dockerfile/i, /\.github\//i,
];

const MEDIUM_RISK_PATTERNS = [
  /package\.json/i, /tsconfig/i, /config/i,
  /api\//i, /server\//i, /middleware/i,
];

const LOW_RISK_PATTERNS = [
  /test/i, /spec/i, /\.test\./i, /\.spec\./i,
  /docs\//i, /readme/i, /\.md$/i,
];

/**
 * Assess risk of an operation based on files changed.
 */
export function assessRisk({ operation, filesChanged = [], agentId }) {
  let maxScore = 0;

  for (const file of filesChanged) {
    if (HIGH_RISK_PATTERNS.some(p => p.test(file))) {
      maxScore = Math.max(maxScore, 2); // high
    } else if (MEDIUM_RISK_PATTERNS.some(p => p.test(file))) {
      maxScore = Math.max(maxScore, 1); // medium
    }
    // LOW_RISK_PATTERNS and default stay at 0 (low)
  }

  // If only test/doc files, force low
  const allTests = filesChanged.every(f => LOW_RISK_PATTERNS.some(p => p.test(f)));
  if (allTests && filesChanged.length > 0) maxScore = 0;

  const tier = RISK_TIERS[Math.min(maxScore, RISK_TIERS.length - 1)];
  const requiresApproval = maxScore >= 1; // medium+ needs approval

  return {
    tier,
    score: maxScore,
    requiresApproval,
    filesAnalyzed: filesChanged.length,
    operation,
    agentId,
  };
}
