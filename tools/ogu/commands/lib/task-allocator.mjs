import { loadOrgSpec, matchRole } from './agent-registry.mjs';
import { checkBudget } from './budget-tracker.mjs';

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

  const { taskId, requiredCapabilities = [], riskTier, preferredRole } = taskSpec;

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
