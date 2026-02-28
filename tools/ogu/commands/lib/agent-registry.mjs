import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Agent Registry — role matching, agent state, OrgSpec access, validation.
 *
 * Core functions for multi-agent runtime:
 *   loadOrgSpec()               — Load and validate OrgSpec.json
 *   validateOrgSpec(spec)       — Validate integrity (duplicates, escalations, budgets, teams)
 *   matchRole(spec, criteria)   — Find best role by phase, riskTier, capability
 *   loadAgentState(roleId)      — Load per-agent state (or create default)
 *   saveAgentState(roleId, st)  — Persist agent state to disk
 *   riskTierLevel(tier)         — Convert risk tier to numeric level
 */

const ORGSPEC_PATH = '.ogu/OrgSpec.json';
const AGENT_STATE_DIR = '.ogu/agents';

const RISK_ORDER = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Load and validate OrgSpec.
 */
export function loadOrgSpec(root) {
  root = root || repoRoot();
  const orgPath = join(root, ORGSPEC_PATH);
  if (!existsSync(orgPath)) return null;
  const spec = JSON.parse(readFileSync(orgPath, 'utf8'));
  if (!spec || !spec.roles) throw new Error('OGU2001: OrgSpec missing or invalid');
  return spec;
}

/**
 * Validate OrgSpec integrity:
 * - No duplicate roleIds
 * - All escalation paths reference valid roles
 * - All team roles exist
 * - Budget quotas are positive
 * - Teams have valid leads
 */
export function validateOrgSpec(spec) {
  const roleIds = new Set();
  const errors = [];

  for (const role of spec.roles) {
    if (roleIds.has(role.roleId)) {
      errors.push(`OGU2002: Duplicate roleId: ${role.roleId}`);
    }
    roleIds.add(role.roleId);

    // Validate escalation paths
    const esc = role.escalationPath;
    const escArray = Array.isArray(esc) ? esc : (esc ? [esc] : []);
    for (const target of escArray) {
      if (!spec.roles.some(r => r.roleId === target)) {
        errors.push(`OGU2003: Escalation target '${target}' not found for role '${role.roleId}'`);
      }
    }

    // Validate budget quotas
    if (role.budgetQuota?.dailyTokens <= 0) {
      errors.push(`OGU2004: Invalid budget for '${role.roleId}'`);
    }

    // Validate phases reference valid pipeline phases
    const validPhases = ['idea', 'feature', 'architect', 'design', 'preflight', 'lock', 'build', 'verify', 'enforce', 'preview', 'done', 'observe', 'pipeline', 'governance'];
    if (role.phases) {
      for (const p of role.phases) {
        if (!validPhases.includes(p)) {
          errors.push(`OGU2006: Invalid phase '${p}' for role '${role.roleId}'`);
        }
      }
    }
  }

  // Validate teams
  for (const team of spec.teams || []) {
    for (const roleId of team.roles || []) {
      if (!roleIds.has(roleId)) {
        errors.push(`OGU2005: Team '${team.teamId}' references unknown role '${roleId}'`);
      }
    }
    if (team.lead && !roleIds.has(team.lead)) {
      errors.push(`OGU2005: Team '${team.teamId}' lead '${team.lead}' not found in roles`);
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
  return true;
}

/**
 * Find the best agent role for a given phase and task.
 * Supports both legacy criteria (capability, department) and plan-specified criteria (phase, riskTier).
 *
 * @param {object} criteria
 * @param {string} [criteria.phase]       — Pipeline phase to match
 * @param {string} [criteria.capability]  — Required capability
 * @param {string} [criteria.roleId]      — Exact role ID match
 * @param {string} [criteria.department]  — Department filter
 * @param {string} [criteria.riskTier]    — Minimum risk tier needed
 * @param {string} [criteria.maxRiskTier] — Maximum allowed risk tier
 * @param {string} [criteria.taskType]    — Task type for filtering
 * @returns {object|null} Matched role or null
 */
export function matchRole(criteria = {}) {
  const org = loadOrgSpec();
  if (!org) return null;

  let candidates = org.roles.filter(r => r.enabled !== false);

  // Exact roleId match
  if (criteria.roleId) {
    return candidates.find(r => r.roleId === criteria.roleId) || null;
  }

  // Phase-based filtering
  if (criteria.phase) {
    const phaseMatches = candidates.filter(r =>
      r.phases && r.phases.includes(criteria.phase)
    );
    if (phaseMatches.length > 0) {
      candidates = phaseMatches;
    }
  }

  // Capability filtering
  if (criteria.capability) {
    candidates = candidates.filter(r =>
      r.capabilities.includes(criteria.capability)
    );
  }

  // Department filtering
  if (criteria.department) {
    candidates = candidates.filter(r => r.department === criteria.department);
  }

  // Risk tier filtering (minimum)
  if (criteria.riskTier) {
    const minLevel = riskTierLevel(criteria.riskTier);
    candidates = candidates.filter(r =>
      riskTierLevel(r.riskTier) >= minLevel
    );
  }

  // Risk tier filtering (maximum)
  if (criteria.maxRiskTier) {
    const maxLevel = riskTierLevel(criteria.maxRiskTier);
    candidates = candidates.filter(r =>
      riskTierLevel(r.riskTier) <= maxLevel
    );
  }

  if (candidates.length === 0) {
    // Fallback to defaults
    const org2 = loadOrgSpec();
    if (org2?.defaults) {
      return { roleId: '_default', ...org2.defaults };
    }
    return null;
  }

  // Prefer lowest sufficient risk tier, then lowest cost
  candidates.sort((a, b) => {
    const riskA = riskTierLevel(a.riskTier);
    const riskB = riskTierLevel(b.riskTier);
    if (riskA !== riskB) return riskA - riskB;
    return (a.maxTokensPerTask || 0) - (b.maxTokensPerTask || 0);
  });

  return candidates[0];
}

/**
 * Load per-agent state from disk.
 * Returns default state if file doesn't exist.
 */
export function loadAgentState(roleId, root) {
  root = root || repoRoot();
  const statePath = join(root, AGENT_STATE_DIR, `${roleId}.state.json`);

  if (existsSync(statePath)) {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  }

  return {
    roleId,
    date: new Date().toISOString().split('T')[0],
    tasksCompleted: 0,
    tasksFailed: 0,
    tokensUsed: 0,
    tokensUsedToday: 0,
    costUsed: 0,
    costToday: 0,
    escalations: 0,
    lastActiveAt: null,
    currentTask: null,
    lastAction: null,
    history: [],
  };
}

/**
 * Persist agent state to disk.
 */
export function saveAgentState(roleId, state) {
  const root = repoRoot();
  const dir = join(root, AGENT_STATE_DIR);
  mkdirSync(dir, { recursive: true });
  const statePath = join(dir, `${roleId}.state.json`);
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Convert risk tier string to numeric level.
 */
export function riskTierLevel(tier) {
  return RISK_ORDER[tier] || 2;
}
