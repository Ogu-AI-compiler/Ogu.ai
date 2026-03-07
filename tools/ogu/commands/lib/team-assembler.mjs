/**
 * team-assembler.mjs — Slice 417
 * Translates a TeamBlueprint into a concrete team.json by matching marketplace agents
 * to roles and allocating capacity.
 *
 * For each role slot in the blueprint:
 *   1. Search marketplace for agents matching the role
 *   2. Score candidates (role match, specialty, tier, available capacity)
 *   3. Pick best fit → create allocation via marketplace-allocator
 *   4. If no agent found → slot marked "unassigned" (user must assign manually)
 *
 * Storage: .ogu/projects/{projectId}/team.json
 *
 * team.json format:
 *   {
 *     team_id, project_id, blueprint_id, created_at,
 *     members: [{
 *       member_id, role_id, role_display,
 *       agent_id, agent_name, allocation_id,
 *       capacity_units, allocated_units, status
 *     }],
 *     total_slots, assigned_slots, unassigned_slots
 *   }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './runtime-paths.mjs';
import { searchAgents, loadAgent } from './agent-store.mjs';
import { hireAgent, getAvailableCapacity, listProjectAllocations } from './marketplace-allocator.mjs';

// ── Capacity defaults per role ────────────────────────────────────────────────

const ROLE_CAPACITY = {
  pm: 6,
  architect: 8,
  backend_engineer: 10,
  frontend_engineer: 10,
  qa: 8,
  devops: 8,
  security: 8,
  designer: 6,
  default: 6,
};

/**
 * defaultCapacity(roleId) → number
 */
export function defaultCapacity(roleId) {
  return ROLE_CAPACITY[roleId] ?? ROLE_CAPACITY.default;
}

// ── Role synonym map (for agent search) ──────────────────────────────────────

const ROLE_TO_SEARCH = {
  pm: ['pm', 'product_manager', 'product manager', 'product'],
  architect: ['architect', 'architecture', 'tech lead', 'technical lead'],
  backend_engineer: ['backend', 'backend_engineer', 'engineer', 'developer'],
  frontend_engineer: ['frontend', 'frontend_engineer', 'ui', 'react', 'vue'],
  qa: ['qa', 'quality', 'tester', 'test'],
  devops: ['devops', 'devops_engineer', 'infrastructure', 'platform', 'sre'],
  security: ['security', 'security_engineer', 'appsec', 'infosec'],
  designer: ['designer', 'ux', 'ui_ux', 'design'],
};

// ── Agent scoring ─────────────────────────────────────────────────────────────

/**
 * scoreAgentForRole(agent, roleId) → number
 * Higher = better fit.
 */
export function scoreAgentForRole(agent, roleId) {
  if (!agent || !roleId) return 0;

  const synonyms = ROLE_TO_SEARCH[roleId] || [roleId];
  const agentRole = (agent.role || '').toLowerCase();
  const agentSpecialty = (agent.specialty || '').toLowerCase();
  const agentSkills = (agent.skills || []).join(' ').toLowerCase();

  let score = 0;

  // Role match
  for (const syn of synonyms) {
    if (agentRole.includes(syn)) { score += 10; break; }
  }
  for (const syn of synonyms) {
    if (agentSpecialty.includes(syn)) { score += 5; break; }
  }
  for (const syn of synonyms) {
    if (agentSkills.includes(syn)) { score += 2; break; }
  }

  // Prefer higher tier agents
  score += (agent.tier || 1) * 0.5;

  return score;
}

/**
 * matchAgentToRole(agents, roleId) → { agent, score } | null
 * Picks the best marketplace agent for a role from a list.
 * Returns null if no suitable agent found (score = 0).
 */
export function matchAgentToRole(agents, roleId) {
  if (!Array.isArray(agents) || agents.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const agent of agents) {
    const score = scoreAgentForRole(agent, roleId);
    if (score > bestScore) { bestScore = score; best = agent; }
  }

  return best && bestScore > 0 ? { agent: best, score: bestScore } : null;
}

// ── Assembly ──────────────────────────────────────────────────────────────────

/**
 * assembleTeam(root, { projectId, teamBlueprint, preferences? }) → TeamConfig
 *
 * teamBlueprint: output of cto-planner.buildTeamBlueprint()
 * preferences: { excludeAgentIds?, minTier?, preferSpecialty? }
 *
 * Saves team.json and creates marketplace allocations for matched agents.
 * Slots without matches are left "unassigned".
 */
export function assembleTeam(root, { projectId, teamBlueprint, preferences = {} } = {}) {
  if (!projectId || !teamBlueprint) throw new Error('projectId and teamBlueprint are required');

  const { excludeAgentIds = [], minTier = 1 } = preferences;

  // Marketplace is global — use marketplaceRoot if provided, else fall back to root
  const mktRoot = preferences.marketplaceRoot || root;

  // Load all available marketplace agents from the GLOBAL marketplace
  const allAgents = searchAgents(mktRoot, {}).filter(a => {
    if (excludeAgentIds.includes(a.agent_id)) return false;
    if ((a.tier || 1) < minTier) return false;
    return true;
  });

  const members = [];
  let memberSeq = 1;
  const usedAgentIds = new Set();

  for (const roleSpec of (teamBlueprint.roles || [])) {
    const slotsForRole = roleSpec.count || 1;

    for (let slot = 0; slot < slotsForRole; slot++) {
      const memberId = `tm_${String(memberSeq).padStart(4, '0')}`;
      memberSeq++;

      // Candidates: not yet used, have available capacity (check global marketplace)
      const candidates = allAgents.filter(a => {
        if (usedAgentIds.has(a.agent_id)) return false;
        const cap = getAvailableCapacity(mktRoot, a.agent_id);
        const needed = defaultCapacity(roleSpec.role_id);
        return cap >= needed;
      });

      const match = matchAgentToRole(candidates, roleSpec.role_id);

      if (!match) {
        // Unassigned slot
        members.push({
          member_id: memberId,
          role_id: roleSpec.role_id,
          role_display: roleSpec.role_display,
          agent_id: null,
          agent_name: null,
          allocation_id: null,
          capacity_units: 0,
          allocated_units: 0,
          status: 'unassigned',
          optional: roleSpec.optional || false,
        });
        continue;
      }

      const { agent } = match;
      const allocUnits = defaultCapacity(roleSpec.role_id);

      let allocationId = null;
      try {
        const alloc = hireAgent(mktRoot, {
          projectId,
          agentId: agent.agent_id,
          roleSlot: roleSpec.role_id,
          allocationUnits: allocUnits,
          priorityLevel: 50,
        });
        allocationId = alloc.allocation_id;
      } catch {
        // Capacity check failed at the last moment — leave unassigned
        members.push({
          member_id: memberId,
          role_id: roleSpec.role_id,
          role_display: roleSpec.role_display,
          agent_id: null,
          agent_name: null,
          allocation_id: null,
          capacity_units: 0,
          allocated_units: 0,
          status: 'unassigned',
          optional: roleSpec.optional || false,
        });
        continue;
      }

      usedAgentIds.add(agent.agent_id);

      members.push({
        member_id: memberId,
        role_id: roleSpec.role_id,
        role_display: roleSpec.role_display,
        agent_id: agent.agent_id,
        agent_name: agent.name,
        agent_tier: agent.tier,
        agent_specialty: agent.specialty,
        allocation_id: allocationId,
        capacity_units: agent.capacity_units || allocUnits,
        allocated_units: allocUnits,
        status: 'active',
        optional: roleSpec.optional || false,
      });
    }
  }

  const assigned = members.filter(m => m.status === 'active').length;
  const unassigned = members.filter(m => m.status === 'unassigned').length;

  const teamConfig = {
    team_id: `team_${Date.now()}`,
    project_id: projectId,
    blueprint_id: teamBlueprint.blueprint_id,
    complexity_tier: teamBlueprint.complexity_tier,
    created_at: new Date().toISOString(),
    members,
    total_slots: members.length,
    assigned_slots: assigned,
    unassigned_slots: unassigned,
  };

  saveTeam(root, projectId, teamConfig);
  return teamConfig;
}

// ── Storage ───────────────────────────────────────────────────────────────────

function projectDir(root, projectId) {
  return join(getProjectsDir(root), projectId);
}

/**
 * saveTeam(root, projectId, teamConfig) → void
 */
export function saveTeam(root, projectId, teamConfig) {
  const dir = projectDir(root, projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'team.json'), JSON.stringify(teamConfig, null, 2), 'utf-8');
}

/**
 * loadTeam(root, projectId) → TeamConfig | null
 */
export function loadTeam(root, projectId) {
  const path = join(projectDir(root, projectId), 'team.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

/**
 * getTeamCapacity(root, projectId) → { total, available, members }
 * Returns capacity summary for a project's team.
 */
export function getTeamCapacity(root, projectId) {
  const team = loadTeam(root, projectId);
  if (!team) return { total: 0, available: 0, members: [] };

  const members = team.members
    .filter(m => m.status === 'active' && m.agent_id)
    .map(m => ({
      member_id: m.member_id,
      role_id: m.role_id,
      agent_id: m.agent_id,
      agent_name: m.agent_name,
      capacity_units: m.capacity_units,
      allocated_units: m.allocated_units,
      available_units: getAvailableCapacity(root, m.agent_id),
    }));

  const total = members.reduce((s, m) => s + m.capacity_units, 0);
  const available = members.reduce((s, m) => s + m.available_units, 0);

  return { total, available, members };
}

/**
 * getMemberForRole(root, projectId, roleId) → TeamMember | null
 * Returns the first active team member matching a role_id.
 */
export function getMemberForRole(root, projectId, roleId) {
  const team = loadTeam(root, projectId);
  if (!team) return null;
  return team.members.find(m => m.role_id === roleId && m.status === 'active') || null;
}
