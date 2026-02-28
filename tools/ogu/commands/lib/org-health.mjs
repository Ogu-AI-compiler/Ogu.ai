import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { loadOrgSpec } from './agent-registry.mjs';
import { loadBudget } from './budget-tracker.mjs';

/**
 * Org Health Score — computes a 0-100 score from multiple organizational signals.
 *
 * Components:
 *   - agents: Role diversity, enabled count, escalation paths
 *   - budget: Remaining daily/monthly budget, healthy spending
 *   - governance: Policy rules defined, approval flow working
 *   - pipeline: Features in progress, gate pass rates
 */

/**
 * Compute the overall org health score.
 *
 * @returns {{ overall: number, components: { agents: number, budget: number, governance: number, pipeline: number }, details: object }}
 */
export function computeHealthScore() {
  const root = repoRoot();
  const org = loadOrgSpec();

  const components = {
    agents: computeAgentHealth(org),
    budget: computeBudgetHealth(root),
    governance: computeGovernanceHealth(root),
    pipeline: computePipelineHealth(root),
  };

  // Weighted average
  const weights = { agents: 0.25, budget: 0.25, governance: 0.25, pipeline: 0.25 };
  const overall = Math.round(
    components.agents * weights.agents +
    components.budget * weights.budget +
    components.governance * weights.governance +
    components.pipeline * weights.pipeline
  );

  return { overall, components };
}

function computeAgentHealth(org) {
  if (!org) return 0;

  let score = 0;
  const roles = org.roles || [];

  // Has roles defined (up to 30 points)
  score += Math.min(30, roles.length * 3);

  // Roles are enabled (up to 20 points)
  const enabled = roles.filter(r => r.enabled !== false);
  score += enabled.length > 0 ? 20 : 0;

  // Has multiple departments (up to 20 points)
  const departments = new Set(roles.map(r => r.department));
  score += Math.min(20, departments.size * 5);

  // Has escalation paths (up to 15 points)
  const withEscalation = roles.filter(r => r.escalationPath);
  score += withEscalation.length > 0 ? 15 : 0;

  // Has providers (15 points)
  score += (org.providers || []).length > 0 ? 15 : 0;

  return Math.min(100, score);
}

function computeBudgetHealth(root) {
  let score = 50; // Default decent score

  try {
    const budget = loadBudget();
    if (!budget) return 30;

    // Daily budget utilization (40 points for healthy spending)
    const dailyUsed = budget.daily?.costUsed || 0;
    const dailyLimit = budget.daily?.limit || 50;
    const dailyRatio = dailyUsed / dailyLimit;

    if (dailyRatio < 0.5) score = 80; // Under 50% — healthy
    else if (dailyRatio < 0.8) score = 60; // Under 80% — ok
    else if (dailyRatio < 1.0) score = 40; // Near limit — warning
    else score = 20; // Over budget

    // Budget config exists (bonus)
    if (dailyLimit > 0) score = Math.min(100, score + 10);
  } catch {
    score = 30;
  }

  return score;
}

function computeGovernanceHealth(root) {
  let score = 0;

  // Policy rules file exists (40 points)
  const rulesPath = join(root, '.ogu/policies/rules.json');
  if (existsSync(rulesPath)) {
    try {
      const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
      score += 40;
      // Has active rules (30 points)
      const active = (rules.rules || []).filter(r => r.enabled);
      score += active.length > 0 ? 30 : 0;
      // Has multiple rule types (15 points)
      const effects = new Set(active.flatMap(r => (r.then || []).map(e => e.effect)));
      score += effects.size > 1 ? 15 : 0;
    } catch {
      score += 20; // File exists but malformed
    }
  }

  // Audit trail exists (15 points)
  const auditPath = join(root, '.ogu/audit/current.jsonl');
  if (existsSync(auditPath)) score += 15;

  return Math.min(100, score);
}

function computePipelineHealth(root) {
  let score = 30; // Default for initialized project

  // OrgSpec exists (20 points)
  if (existsSync(join(root, '.ogu/OrgSpec.json'))) score += 20;

  // STATE.json exists (15 points)
  if (existsSync(join(root, '.ogu/STATE.json'))) score += 15;

  // Has features in progress (20 points)
  const stateDir = join(root, '.ogu/state/features');
  if (existsSync(stateDir)) score += 20;

  // CONTEXT.md exists (15 points)
  if (existsSync(join(root, '.ogu/CONTEXT.md'))) score += 15;

  return Math.min(100, score);
}
