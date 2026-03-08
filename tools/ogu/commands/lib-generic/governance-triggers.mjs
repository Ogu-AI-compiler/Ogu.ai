/**
 * Governance Triggers — scope_violation, path_match, budget_exceeded, risk_tier.
 */

import { join } from 'node:path';

export const TRIGGER_TYPES = ['scope_violation', 'path_match', 'budget_exceeded', 'risk_tier'];

const RISK_LEVELS = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Check if a path is outside the agent's ownership scope.
 */
export function checkScopeViolation({ agentId, ownershipScope, targetPath }) {
  const inScope = ownershipScope.some(pattern => {
    const regex = globToRegex(pattern);
    return regex.test(targetPath);
  });

  return {
    triggered: !inScope,
    type: 'scope_violation',
    agentId,
    targetPath,
    ownershipScope,
  };
}

/**
 * Check if a path matches a governance glob pattern.
 */
export function checkPathMatch({ pattern, targetPath }) {
  const regex = globToRegex(pattern);
  const matched = regex.test(targetPath);
  return {
    triggered: matched,
    type: 'path_match',
    pattern,
    targetPath,
  };
}

/**
 * Check if budget usage exceeds threshold.
 */
export function checkBudgetExceeded({ roleId, currentUsage, quota, threshold = 0.90 }) {
  const ratio = currentUsage / quota;
  return {
    triggered: ratio >= threshold,
    type: 'budget_exceeded',
    roleId,
    currentUsage,
    quota,
    ratio,
    threshold,
  };
}

/**
 * Check if operation risk tier requires approval.
 */
export function checkRiskTier({ operation, riskTier, minTierForApproval = 'medium' }) {
  const riskLevel = RISK_LEVELS[riskTier] || 0;
  const minLevel = RISK_LEVELS[minTierForApproval] || 0;

  return {
    triggered: riskLevel >= minLevel,
    type: 'risk_tier',
    operation,
    riskTier,
    riskLevel,
    minTierForApproval,
  };
}

function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${escaped}$`);
}
