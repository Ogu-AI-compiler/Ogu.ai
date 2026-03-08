/**
 * Work Distribution — assign work to available agents.
 */

import { randomUUID } from 'node:crypto';

/**
 * Create a work distributor.
 *
 * @returns {object} Distributor with addAgent/assign/complete/getAssignments
 */
export function createWorkDistributor() {
  const agents = new Map();
  const assignments = new Map(); // assignmentId → assignment

  function addAgent({ id, capabilities = [] }) {
    agents.set(id, { id, capabilities, currentLoad: 0 });
  }

  function assign({ task, requiredCapability }) {
    // Find capable agent with lowest load
    let best = null;
    for (const agent of agents.values()) {
      if (requiredCapability && !agent.capabilities.includes(requiredCapability)) continue;
      if (!best || agent.currentLoad < best.currentLoad) {
        best = agent;
      }
    }
    if (!best) return null;

    const assignmentId = randomUUID().slice(0, 8);
    best.currentLoad++;
    const assignment = { assignmentId, agentId: best.id, task, assignedAt: new Date().toISOString() };
    assignments.set(assignmentId, assignment);
    return assignment;
  }

  function complete(assignmentId) {
    const a = assignments.get(assignmentId);
    if (a) {
      const agent = agents.get(a.agentId);
      if (agent) agent.currentLoad--;
      assignments.delete(assignmentId);
    }
  }

  function getAssignments() {
    return Array.from(assignments.values());
  }

  return { addAgent, assign, complete, getAssignments };
}
