/**
 * capacity-scheduler.mjs — Slice 425
 * Schedules tasks based on marketplace agent capacity.
 *
 * Before running a task, checks if the assigned agent has available capacity.
 * Provides a capacity-aware execution schedule respecting topology + concurrency.
 *
 * Exports:
 *   checkCapacityForTask(root, task) → CapacityCheck
 *   buildCapacitySchedule(root, tasks, opts?) → { runnable, queued, stats }
 *   getSchedulerStats(root, projectId) → SchedulerStats
 *   canRunTask(root, task) → boolean
 */

import { getAvailableCapacity, listProjectAllocations } from './marketplace-allocator.mjs';

// ── Capacity check ────────────────────────────────────────────────────────────

/**
 * checkCapacityForTask(root, task) → CapacityCheck
 *
 * Returns:
 *   { canRun: true, agentId, availableCapacity, reason: 'capacity_available' | 'no_agent_assigned' }
 *   { canRun: false, agentId, availableCapacity, required, reason: string }
 */
export function checkCapacityForTask(root, task) {
  const agentId = task?.owner_agent_id || null;
  const required = task?.capacity_units || 1;

  // No marketplace agent — always runnable (uses OrgSpec pipeline agent)
  if (!agentId) {
    return {
      canRun: true,
      agentId: null,
      availableCapacity: Infinity,
      required,
      reason: 'no_agent_assigned',
    };
  }

  let available;
  try {
    available = getAvailableCapacity(root, agentId);
  } catch {
    // If capacity check fails (e.g. agent not found), allow the task to run
    return {
      canRun: true,
      agentId,
      availableCapacity: Infinity,
      required,
      reason: 'capacity_check_unavailable',
    };
  }

  if (available >= required) {
    return {
      canRun: true,
      agentId,
      availableCapacity: available,
      required,
      reason: 'capacity_available',
    };
  }

  return {
    canRun: false,
    agentId,
    availableCapacity: available,
    required,
    reason: `insufficient_capacity`,
  };
}

/**
 * canRunTask(root, task) → boolean
 * Convenience wrapper — true if task can run now.
 */
export function canRunTask(root, task) {
  return checkCapacityForTask(root, task).canRun;
}

// ── Capacity schedule builder ─────────────────────────────────────────────────

/**
 * buildCapacitySchedule(root, tasks, opts?) → { runnable, queued, stats }
 *
 * Given topologically sorted tasks, splits into runnable (now) vs queued (blocked).
 * Respects:
 *   - Agent capacity (marketplace agents only)
 *   - Concurrency limit (max parallel tasks per schedule)
 *
 * opts:
 *   concurrencyLimit — max tasks to mark as runnable (default: 10)
 *
 * Returns:
 *   runnable  — tasks that can start now
 *   queued    — [ { task, reason } ] — tasks blocked by capacity or concurrency
 *   stats     — { total, runnable, queued, agentsUtilized }
 */
export function buildCapacitySchedule(root, tasks, opts = {}) {
  const { concurrencyLimit = 10 } = opts;

  if (!Array.isArray(tasks)) return { runnable: [], queued: [], stats: { total: 0, runnable: 0, queued: 0, agentsUtilized: 0 } };

  const runnable = [];
  const queued = [];
  const scheduleCapacityUsed = new Map(); // agentId → units used in this schedule pass

  for (const task of tasks) {
    // Concurrency limit reached
    if (runnable.length >= concurrencyLimit) {
      queued.push({ task, reason: 'concurrency_limit' });
      continue;
    }

    const check = checkCapacityForTask(root, task);

    if (!check.canRun) {
      queued.push({ task, reason: check.reason });
      continue;
    }

    // For agents, account for units already used in this schedule pass
    if (check.agentId) {
      const alreadyUsed = scheduleCapacityUsed.get(check.agentId) || 0;
      const required = task.capacity_units || 1;
      if ((check.availableCapacity - alreadyUsed) < required) {
        queued.push({ task, reason: 'schedule_capacity_exceeded' });
        continue;
      }
      scheduleCapacityUsed.set(check.agentId, alreadyUsed + required);
    }

    runnable.push(task);
  }

  return {
    runnable,
    queued,
    stats: {
      total: tasks.length,
      runnable: runnable.length,
      queued: queued.length,
      agentsUtilized: scheduleCapacityUsed.size,
    },
  };
}

// ── Scheduler stats ───────────────────────────────────────────────────────────

/**
 * getSchedulerStats(root, projectId) → SchedulerStats
 * Returns capacity stats for the project's team allocations.
 */
export function getSchedulerStats(root, projectId) {
  let allocations = [];
  try {
    allocations = listProjectAllocations(root, projectId) || [];
  } catch {
    return { projectId, allocations: 0, agentCapacity: {}, timestamp: new Date().toISOString() };
  }

  const agentCapacity = {};
  for (const alloc of allocations) {
    const agentId = alloc.agentId || alloc.agent_id;
    if (!agentId) continue;

    let available = 0;
    try {
      available = getAvailableCapacity(root, agentId);
    } catch { /* skip */ }

    const total = alloc.allocationUnits || 1;
    const used = Math.max(0, total - available);

    agentCapacity[agentId] = {
      agentId,
      roleSlot: alloc.roleSlot || null,
      allocationUnits: total,
      usedUnits: used,
      availableCapacity: available,
      utilizationRatio: total > 0 ? Math.min(1, used / total) : 0,
    };
  }

  return {
    projectId,
    allocations: allocations.length,
    agentCapacity,
    timestamp: new Date().toISOString(),
  };
}
