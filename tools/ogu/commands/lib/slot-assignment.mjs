/**
 * slot-assignment.mjs — Slice 438
 * Marketplace slot assignment flow: assign agents to team slots,
 * check minimum required slots, and trigger build when ready.
 *
 * Exports:
 *   MINIMUM_REQUIRED_ROLES — roles that must be filled before build starts
 *   assignSlot(root, { projectId, memberId, agentId }) → AssignResult
 *   checkMinimumSlots(root, projectId) → SlotCheck
 *   getSlotSummary(root, projectId) → SlotSummary
 *   startBuildIfReady(root, projectId) → BuildReadiness
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hireAgent, getAvailableCapacity } from './marketplace-allocator.mjs';
import { defaultCapacity, loadTeam, saveTeam } from './team-assembler.mjs';
import { getProjectsDir } from './runtime-paths.mjs';

// ── Minimum required roles ──────────────────────────────────────────────────

export const MINIMUM_REQUIRED_ROLES = ['architect', 'backend_engineer'];

// ── assignSlot ──────────────────────────────────────────────────────────────

/**
 * assignSlot(root, { projectId, memberId, agentId }) → AssignResult
 * Assigns a marketplace agent to an unassigned team member slot.
 * Creates a marketplace allocation and updates team.json.
 */
export function assignSlot(root, { projectId, memberId, agentId } = {}) {
  const team = loadTeam(root, projectId);
  if (!team) return { success: false, error: `Team not found for project ${projectId}` };

  const member = team.members.find(m => m.member_id === memberId);
  if (!member) return { success: false, error: `Member ${memberId} not found in team` };

  if (member.status === 'active' && member.agent_id) {
    return { success: false, error: `Slot ${memberId} is already assigned to ${member.agent_id}` };
  }

  // Check agent capacity
  const allocUnits = defaultCapacity(member.role_id);
  let available;
  try {
    available = getAvailableCapacity(root, agentId);
  } catch (e) {
    return { success: false, error: `Agent capacity check failed: ${e.message}` };
  }

  if (available < allocUnits) {
    return { success: false, error: `Agent ${agentId} has insufficient capacity: need ${allocUnits}, available ${available}` };
  }

  // Create marketplace allocation
  let allocation;
  try {
    allocation = hireAgent(root, {
      projectId,
      agentId,
      roleSlot: member.role_id,
      allocationUnits: allocUnits,
      priorityLevel: 50,
    });
  } catch (e) {
    return { success: false, error: `Allocation failed: ${e.message}` };
  }

  // Update member in team
  member.agent_id = agentId;
  member.agent_name = allocation.agent_name || agentId;
  member.allocation_id = allocation.allocation_id;
  member.allocated_units = allocUnits;
  member.capacity_units = allocUnits;
  member.status = 'active';

  // Recount slots
  team.assigned_slots = team.members.filter(m => m.status === 'active').length;
  team.unassigned_slots = team.members.filter(m => m.status === 'unassigned').length;

  saveTeam(root, projectId, team);

  return { success: true, member, allocationId: allocation.allocation_id };
}

// ── checkMinimumSlots ───────────────────────────────────────────────────────

/**
 * checkMinimumSlots(root, projectId) → { ready, missingRoles, filledRoles, totalAssigned, totalUnassigned }
 * Checks whether all minimum required roles have assigned agents.
 * Optional roles that are unassigned don't block readiness.
 */
export function checkMinimumSlots(root, projectId) {
  const team = loadTeam(root, projectId);
  if (!team) {
    return {
      ready: false,
      missingRoles: [...MINIMUM_REQUIRED_ROLES],
      filledRoles: [],
      totalAssigned: 0,
      totalUnassigned: 0,
    };
  }

  const activeRoles = new Set(
    team.members
      .filter(m => m.status === 'active' && m.agent_id)
      .map(m => m.role_id)
  );

  // Check which required roles are in the team definition
  const teamRoleIds = new Set(team.members.map(m => m.role_id));
  const missingRoles = MINIMUM_REQUIRED_ROLES.filter(role =>
    teamRoleIds.has(role) && !activeRoles.has(role)
  );
  const filledRoles = MINIMUM_REQUIRED_ROLES.filter(role => activeRoles.has(role));

  // Also check non-optional unassigned slots
  const requiredUnassigned = team.members.filter(
    m => m.status === 'unassigned' && !m.optional && MINIMUM_REQUIRED_ROLES.includes(m.role_id)
  );

  return {
    ready: missingRoles.length === 0,
    missingRoles,
    filledRoles,
    totalAssigned: team.assigned_slots || team.members.filter(m => m.status === 'active').length,
    totalUnassigned: team.unassigned_slots || team.members.filter(m => m.status === 'unassigned').length,
  };
}

// ── getSlotSummary ──────────────────────────────────────────────────────────

/**
 * getSlotSummary(root, projectId) → SlotSummary
 * Returns a summary of all team slots with their assignment status.
 */
export function getSlotSummary(root, projectId) {
  const team = loadTeam(root, projectId);
  if (!team) {
    return { totalSlots: 0, assignedSlots: 0, unassignedSlots: 0, members: [] };
  }

  return {
    totalSlots: team.members.length,
    assignedSlots: team.members.filter(m => m.status === 'active').length,
    unassignedSlots: team.members.filter(m => m.status === 'unassigned').length,
    members: team.members.map(m => ({
      memberId: m.member_id,
      roleId: m.role_id,
      roleDisplay: m.role_display,
      agentId: m.agent_id,
      agentName: m.agent_name,
      status: m.status,
      optional: m.optional || false,
    })),
  };
}

// ── startBuildIfReady ───────────────────────────────────────────────────────

/**
 * startBuildIfReady(root, projectId) → BuildReadiness
 * Checks minimum slots + enriched plan existence.
 * Returns { ready, taskCount, assignedAgents, missingRoles?, error? }.
 */
export function startBuildIfReady(root, projectId) {
  const slotCheck = checkMinimumSlots(root, projectId);
  if (!slotCheck.ready) {
    return {
      ready: false,
      missingRoles: slotCheck.missingRoles,
      error: `Missing required roles: ${slotCheck.missingRoles.join(', ')}`,
    };
  }

  // Check enriched plan exists
  const planPath = join(getProjectsDir(root), projectId, 'plan.enriched.json');
  if (!existsSync(planPath)) {
    return {
      ready: false,
      missingRoles: [],
      error: `Enriched plan not found — run pipeline planning first`,
    };
  }

  let plan;
  try { plan = JSON.parse(readFileSync(planPath, 'utf-8')); }
  catch { return { ready: false, missingRoles: [], error: 'Failed to parse plan.enriched.json' }; }

  const tasks = plan.tasks || [];
  const team = loadTeam(root, projectId);
  const assignedAgents = (team?.members || [])
    .filter(m => m.status === 'active' && m.agent_id)
    .map(m => ({
      memberId: m.member_id,
      roleId: m.role_id,
      agentId: m.agent_id,
      agentName: m.agent_name,
    }));

  return {
    ready: true,
    taskCount: tasks.length,
    assignedAgents,
  };
}
