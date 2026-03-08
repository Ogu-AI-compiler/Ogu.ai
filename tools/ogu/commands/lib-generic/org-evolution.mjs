/**
 * Org Evolution — propose, validate, and apply org structure changes.
 */

import { randomUUID } from 'node:crypto';

export const EVOLUTION_TYPES = ['add_role', 'remove_role', 'add_agent', 'remove_agent', 'merge_team', 'split_team'];

/**
 * Create an evolution proposal.
 *
 * @param {{ current: object, changes: Array<{ type: string, [key: string]: any }> }} opts
 * @returns {object} Proposal with id, status, changes
 */
export function proposeEvolution({ current, changes }) {
  return {
    id: randomUUID().slice(0, 8),
    status: 'proposed',
    current: { ...current },
    changes,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate an evolution proposal for feasibility.
 *
 * @param {object} proposal
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEvolution(proposal) {
  const errors = [];
  for (const change of proposal.changes) {
    if (!EVOLUTION_TYPES.includes(change.type)) {
      errors.push(`Unknown change type: ${change.type}`);
    }
    if (change.type === 'remove_role' && !proposal.current.roles?.includes(change.role)) {
      errors.push(`Cannot remove non-existent role: ${change.role}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Apply evolution changes to an org structure.
 *
 * @param {object} current
 * @param {object} proposal
 * @returns {object} New org structure
 */
export function applyEvolution(current, proposal) {
  const result = {
    roles: [...(current.roles || [])],
    agents: current.agents || 0,
  };

  for (const change of proposal.changes) {
    switch (change.type) {
      case 'add_role':
        if (!result.roles.includes(change.role)) result.roles.push(change.role);
        break;
      case 'remove_role':
        result.roles = result.roles.filter(r => r !== change.role);
        break;
      case 'add_agent':
        result.agents++;
        break;
      case 'remove_agent':
        result.agents = Math.max(0, result.agents - 1);
        break;
    }
  }

  return result;
}

/**
 * Diff current org with proposed org.
 *
 * @param {object} current
 * @param {object} proposed
 * @returns {{ addedRoles: string[], removedRoles: string[], agentDelta: number }}
 */
export function diffWithCurrent(current, proposed) {
  const currentRoles = current.roles || [];
  const proposedRoles = proposed.roles || [];
  return {
    addedRoles: proposedRoles.filter(r => !currentRoles.includes(r)),
    removedRoles: currentRoles.filter(r => !proposedRoles.includes(r)),
    agentDelta: (proposed.agents || 0) - (current.agents || 0),
  };
}
