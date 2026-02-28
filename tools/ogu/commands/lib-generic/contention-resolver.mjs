/**
 * Resource Contention Resolver — resolve conflicts when agents compete for resources.
 */

import { randomUUID } from 'node:crypto';

export const RESOLUTION_STRATEGIES = ['priority', 'queue', 'abort-lower', 'merge'];

/**
 * Create a contention resolver.
 *
 * @returns {object} Resolver with reportConflict/resolve/listConflicts
 */
export function createContentionResolver() {
  const conflicts = new Map(); // id → { resource, agents, type, resolved }

  function reportConflict({ resource, agents, type = 'write-write' }) {
    const id = randomUUID().slice(0, 12);
    conflicts.set(id, {
      id,
      resource,
      agents: [...agents],
      type,
      resolved: false,
      resolution: null,
      reportedAt: new Date().toISOString(),
    });
    return id;
  }

  function resolve(conflictId, { strategy = 'queue', priorities = {} } = {}) {
    const conflict = conflicts.get(conflictId);
    if (!conflict) throw new Error(`Conflict ${conflictId} not found`);

    let winner, queued;

    switch (strategy) {
      case 'priority': {
        const sorted = [...conflict.agents].sort((a, b) =>
          (priorities[b] || 0) - (priorities[a] || 0)
        );
        winner = sorted[0];
        queued = sorted.slice(1);
        break;
      }
      case 'queue':
      default: {
        winner = conflict.agents[0];
        queued = conflict.agents.slice(1);
        break;
      }
    }

    conflict.resolved = true;
    conflict.resolution = { strategy, winner, queued };

    return { winner, queued, strategy, resource: conflict.resource };
  }

  function listConflicts() {
    return Array.from(conflicts.values());
  }

  return { reportConflict, resolve, listConflicts };
}
