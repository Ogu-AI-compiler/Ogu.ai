/**
 * task-assignment-engine.mjs — Slice 430
 * Dependency-aware, capacity-aware task assignment engine.
 *
 * Combines:
 *   - Dependency completion checking (not just topological order)
 *   - Agent capacity validation (marketplace agents)
 *   - Role matching (task.owner_role → available agent)
 *
 * This is the "brain" of the scheduler: given the current execution state,
 * it returns exactly which tasks should start NOW and who should run them.
 *
 * Exports:
 *   getReadyTasks(tasks, completedIds, failedIds) → Task[]
 *   matchAgentForTask(root, task) → AgentMatch | null
 *   getReadyAssignments(root, tasks, completedIds, failedIds) → Assignment[]
 *   buildExecutionWave(root, tasks, completedIds, failedIds, opts) → Wave
 */

import { searchAgents } from './agent-store.mjs';
import { getAvailableCapacity, listProjectAllocations } from './marketplace-allocator.mjs';

// ── Ready-task detection ──────────────────────────────────────────────────────

/**
 * getReadyTasks(tasks, completedIds, failedIds) → Task[]
 *
 * Returns tasks that can start right now:
 *   - Not already completed, failed, skipped, or running
 *   - All dependsOn entries are in completedIds
 *   - No dependsOn entry is in failedIds (would never complete)
 */
export function getReadyTasks(tasks, completedIds = new Set(), failedIds = new Set()) {
  if (!Array.isArray(tasks)) return [];

  const skippable = new Set(failedIds);

  return tasks.filter(task => {
    const tid = task.id || task.task_id;
    if (!tid) return false;

    // Already settled
    if (completedIds.has(tid) || failedIds.has(tid)) return false;

    const deps = task.dependsOn || task.depends_on || [];

    // Blocked by failed/skipped dependency
    if (deps.some(d => skippable.has(d))) return false;

    // Not all deps done yet
    if (!deps.every(d => completedIds.has(d))) return false;

    return true;
  });
}

// ── Agent matching ────────────────────────────────────────────────────────────

/**
 * matchAgentForTask(root, task) → AgentMatch | null
 *
 * Finds the best available marketplace agent for this task.
 * Priority order:
 *   1. task.owner_agent_id (explicitly assigned)
 *   2. Project team allocation for task.owner_role (from featureSlug/projectId)
 *   3. Global marketplace search by role
 *
 * Returns:
 *   { agentId, role, availableCapacity, required, source: 'assigned'|'team'|'marketplace' }
 * or null if no agent found or capacity insufficient.
 */
export function matchAgentForTask(root, task) {
  const required = task.capacity_units || 1;

  // Option 1: explicitly assigned agent
  if (task.owner_agent_id) {
    let available = Infinity;
    try { available = getAvailableCapacity(root, task.owner_agent_id); } catch { /* ok */ }

    if (available >= required) {
      return {
        agentId: task.owner_agent_id,
        role: task.owner_role || null,
        availableCapacity: available,
        required,
        source: 'assigned',
      };
    }
    // Assigned agent doesn't have capacity
    return null;
  }

  // Option 2: search marketplace by role
  if (task.owner_role) {
    let candidates = [];
    try {
      candidates = searchAgents(root, { role: task.owner_role }) || [];
    } catch { /* no marketplace */ }

    // Find first agent with sufficient capacity
    for (const agent of candidates) {
      const agentId = agent.agent_id || agent.id;
      if (!agentId) continue;

      let available = 0;
      try { available = getAvailableCapacity(root, agentId); } catch { available = agent.capacity_units || 0; }

      if (available >= required) {
        return {
          agentId,
          role: task.owner_role,
          availableCapacity: available,
          required,
          source: 'marketplace',
        };
      }
    }
  }

  // No agent found — task runs without a marketplace agent (uses OrgSpec pipeline)
  return {
    agentId: null,
    role: task.owner_role || null,
    availableCapacity: Infinity,
    required,
    source: 'pipeline',
  };
}

// ── Assignment building ───────────────────────────────────────────────────────

/**
 * getReadyAssignments(root, tasks, completedIds, failedIds) → Assignment[]
 *
 * Assignment: {
 *   taskId, task, agentId, role, source,
 *   availableCapacity, required,
 *   reason: 'ready'
 * }
 *
 * Returns structured assignments for all tasks that can start now.
 * Filters out tasks that have no available agent capacity.
 */
export function getReadyAssignments(root, tasks, completedIds = new Set(), failedIds = new Set()) {
  const readyTasks = getReadyTasks(tasks, completedIds, failedIds);
  const assignments = [];
  const capacityReserved = new Map(); // agentId → units reserved in this call

  for (const task of readyTasks) {
    const taskId = task.id || task.task_id;
    const match = matchAgentForTask(root, task);

    if (!match) {
      // No agent available with capacity
      continue;
    }

    // Check schedule-level capacity (avoid double-assigning same agent)
    if (match.agentId) {
      const alreadyReserved = capacityReserved.get(match.agentId) || 0;
      const effectiveAvailable = match.availableCapacity - alreadyReserved;

      if (effectiveAvailable < match.required) {
        continue; // skip — agent busy with earlier wave task
      }

      capacityReserved.set(match.agentId, alreadyReserved + match.required);
    }

    assignments.push({
      taskId,
      task,
      agentId: match.agentId,
      role: match.role,
      source: match.source,
      availableCapacity: match.availableCapacity,
      required: match.required,
      reason: 'ready',
    });
  }

  return assignments;
}

// ── Execution wave ────────────────────────────────────────────────────────────

/**
 * buildExecutionWave(root, tasks, completedIds, failedIds, opts) → Wave
 *
 * Wave: {
 *   assignments: Assignment[],   — tasks that can start now
 *   blocked: BlockedTask[],      — tasks blocked (dep failed, no capacity, dep pending)
 *   stats: {
 *     total, ready, assigned, blocked,
 *     blockedByDep, blockedByCapacity, blockedByPendingDep
 *   }
 * }
 *
 * opts:
 *   maxWaveSize — cap on how many tasks can be in one wave (default: 10)
 */
export function buildExecutionWave(root, tasks, completedIds = new Set(), failedIds = new Set(), opts = {}) {
  const { maxWaveSize = 10 } = opts;

  if (!Array.isArray(tasks)) {
    return {
      assignments: [],
      blocked: [],
      stats: { total: 0, ready: 0, assigned: 0, blocked: 0, blockedByDep: 0, blockedByCapacity: 0, blockedByPendingDep: 0 },
    };
  }

  const blocked = [];
  let blockedByDep = 0;
  let blockedByCapacity = 0;
  let blockedByPendingDep = 0;

  for (const task of tasks) {
    const tid = task.id || task.task_id;
    if (!tid) continue;
    if (completedIds.has(tid) || failedIds.has(tid)) continue;

    const deps = task.dependsOn || task.depends_on || [];

    if (deps.some(d => failedIds.has(d))) {
      blocked.push({ task, reason: 'dependency_failed' });
      blockedByDep++;
    } else if (!deps.every(d => completedIds.has(d))) {
      blocked.push({ task, reason: 'dependency_pending' });
      blockedByPendingDep++;
    }
  }

  // Get full ready assignments
  const allAssignments = getReadyAssignments(root, tasks, completedIds, failedIds);

  // Find tasks that were "ready by deps" but couldn't get an agent
  const readyTaskIds = new Set(getReadyTasks(tasks, completedIds, failedIds).map(t => t.id || t.task_id));
  const assignedTaskIds = new Set(allAssignments.map(a => a.taskId));

  for (const tid of readyTaskIds) {
    if (!assignedTaskIds.has(tid)) {
      const task = tasks.find(t => (t.id || t.task_id) === tid);
      if (task) {
        blocked.push({ task, reason: 'no_capacity' });
        blockedByCapacity++;
      }
    }
  }

  // Apply wave size cap
  const waveAssignments = allAssignments.slice(0, maxWaveSize);

  return {
    assignments: waveAssignments,
    blocked,
    stats: {
      total: tasks.filter(t => {
        const tid = t.id || t.task_id;
        return !completedIds.has(tid) && !failedIds.has(tid);
      }).length,
      ready: readyTaskIds.size,
      assigned: waveAssignments.length,
      blocked: blocked.length,
      blockedByDep,
      blockedByCapacity,
      blockedByPendingDep,
    },
  };
}
