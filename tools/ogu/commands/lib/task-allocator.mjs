import { loadOrgSpec, matchRole } from './agent-registry.mjs';
import { checkBudget } from './budget-tracker.mjs';
import { resolveMarketplaceAgent } from './marketplace-bridge.mjs';

/**
 * Task Allocator — matches tasks to agent roles based on
 * capability requirements, risk tier, and budget availability.
 *
 * Core functions:
 *   allocateTask(taskSpec)   — Find best role for a single task
 *   allocatePlan(tasks)      — Allocate roles for an entire Plan.json task array
 */

const RISK_ORDER = ['low', 'medium', 'high', 'critical'];

/**
 * Allocate the best agent role for a single task.
 *
 * @param {object} taskSpec
 * @param {string} taskSpec.taskId
 * @param {string[]} taskSpec.requiredCapabilities — capabilities this task needs
 * @param {string} [taskSpec.riskTier] — maximum risk tier allowed
 * @param {string} [taskSpec.preferredRole] — prefer this specific role
 * @returns {object|null} Allocation result: { taskId, roleId, roleName, capabilities, riskTier, model }
 */
export function allocateTask(taskSpec) {
  const org = loadOrgSpec();
  if (!org) return null;

  const { taskId, requiredCapabilities = [], riskTier, preferredRole, root, featureSlug } = taskSpec;

  // Marketplace-first lookup: if a hired agent matches the role, prefer it
  if (root && featureSlug) {
    try {
      const mp = resolveMarketplaceAgent(root, { featureSlug, roleId: preferredRole });
      if (mp.found) {
        return {
          taskId,
          roleId: preferredRole || mp.agent.role || mp.agent.specialty,
          roleName: mp.agent.name,
          capabilities: mp.skills || mp.agent.capabilities || [],
          riskTier: riskTier || 'medium',
          maxTokensPerTask: mp.agent.max_tokens_per_task || 8192,
          department: mp.agent.department || 'marketplace',
          _marketplaceAgentId: mp.agent.agent_id,
        };
      }
    } catch { /* fall through to OrgSpec */ }
  }

  // If preferred role specified, try it first
  if (preferredRole) {
    const role = matchRole({ roleId: preferredRole });
    if (role) {
      const hasAll = requiredCapabilities.every(c => role.capabilities.includes(c));
      if (hasAll) {
        return buildAllocation(taskId, role);
      }
    }
  }

  // Get all enabled roles
  let candidates = org.roles.filter(r => r.enabled !== false);

  // Filter by required capabilities — role must have ALL required capabilities
  if (requiredCapabilities.length > 0) {
    candidates = candidates.filter(role =>
      requiredCapabilities.every(cap => role.capabilities.includes(cap))
    );
  }

  // Filter by risk tier — role risk must be <= task max risk
  if (riskTier) {
    const maxIdx = RISK_ORDER.indexOf(riskTier);
    if (maxIdx >= 0) {
      candidates = candidates.filter(role => {
        const roleIdx = RISK_ORDER.indexOf(role.riskTier);
        return roleIdx >= 0 && roleIdx <= maxIdx;
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort: prefer lowest risk, then cheapest (lowest maxTokensPerTask)
  candidates.sort((a, b) => {
    const riskA = RISK_ORDER.indexOf(a.riskTier);
    const riskB = RISK_ORDER.indexOf(b.riskTier);
    if (riskA !== riskB) return riskA - riskB;
    return (a.maxTokensPerTask || 0) - (b.maxTokensPerTask || 0);
  });

  return buildAllocation(taskId, candidates[0]);
}

/**
 * Allocate agent roles for all tasks in a Plan.
 *
 * @param {Array<object>} tasks — Plan.json tasks array
 * @returns {Array<object>} Allocation results for each task
 */
export function allocatePlan(tasks) {
  return tasks.map(task => {
    const alloc = allocateTask({
      taskId: task.id,
      requiredCapabilities: task.requiredCapabilities || [],
      riskTier: task.riskTier,
    });

    if (!alloc) {
      return {
        taskId: task.id,
        roleId: null,
        error: `No matching role for capabilities: ${(task.requiredCapabilities || []).join(', ')}`,
      };
    }

    return alloc;
  });
}

function buildAllocation(taskId, role) {
  return {
    taskId,
    roleId: role.roleId,
    roleName: role.name,
    capabilities: role.capabilities,
    riskTier: role.riskTier,
    maxTokensPerTask: role.maxTokensPerTask,
    department: role.department,
  };
}

/**
 * Estimate the cost of a task in tokens and USD.
 */
export function estimateTaskCost({ complexity = 'medium', files = [], requiredCapabilities = [] } = {}) {
  const baseTokens = { low: 2000, medium: 8000, high: 20000, critical: 50000 };
  const base = baseTokens[complexity] || 8000;
  const fileMultiplier = 1 + (files.length * 0.1);
  const capMultiplier = 1 + (requiredCapabilities.length * 0.05);
  const estimatedTokens = Math.round(base * fileMultiplier * capMultiplier);
  const estimatedCost = estimatedTokens * 0.000003; // $3 per 1M tokens approx
  return {
    estimatedTokens,
    estimatedCost: parseFloat(estimatedCost.toFixed(6)),
    confidence: complexity === 'low' ? 'high' : complexity === 'medium' ? 'medium' : 'low',
    breakdown: { base, fileMultiplier, capMultiplier, files: files.length, capabilities: requiredCapabilities.length },
  };
}

/**
 * Check governance constraints for a task allocation.
 */
export function checkGovernance({ taskId, riskTier = 'low', touches = [], requiredCapabilities = [] } = {}) {
  const criticalTiers = new Set(['critical', 'high']);
  if (criticalTiers.has(riskTier)) {
    return { allowed: false, decision: 'REQUIRES_APPROVAL', taskId, riskTier, reason: `Risk tier "${riskTier}" requires approval` };
  }
  // Security-sensitive files require approval
  const securityFiles = touches.filter(f => f.includes('auth') || f.includes('secret') || f.includes('key'));
  if (securityFiles.length > 0) {
    return { allowed: false, decision: 'REQUIRES_APPROVAL', taskId, riskTier, reason: 'Security-sensitive files require approval' };
  }
  return { allowed: true, decision: 'ALLOW', taskId, riskTier };
}

/**
 * Resolve artifact dependencies for a task.
 */
export function resolveArtifactDeps(task, { completedTasks = new Set(), artifacts = new Map() } = {}) {
  const missing = [];
  for (const dep of (task.dependsOn || [])) {
    if (!completedTasks.has(dep)) {
      missing.push({ taskId: dep, reason: 'not completed' });
    }
  }
  for (const art of (task.requiredArtifacts || [])) {
    if (!artifacts.has(art)) {
      missing.push({ artifactId: art, reason: 'not produced' });
    }
  }
  return { resolved: missing.length === 0, missing };
}
