/**
 * Agent Lifecycle Manager — spawn, track, heartbeat, shutdown agents.
 *
 * In-memory agent registry with status tracking and graceful shutdown.
 */

import { randomUUID } from 'node:crypto';

/**
 * Valid agent states.
 */
export const AGENT_STATES = ['pending', 'running', 'stopped', 'failed'];

/**
 * Create an agent manager instance.
 *
 * @param {object} opts
 * @param {string} opts.root - Project root
 * @returns {object} Manager with spawn/getStatus/heartbeat/shutdown/listAgents
 */
export function createAgentManager({ root } = {}) {
  const agents = new Map();

  function spawn({ roleId, taskId, featureSlug }) {
    const agentId = randomUUID();
    const agent = {
      agentId,
      roleId,
      taskId,
      featureSlug,
      status: 'running',
      spawnedAt: Date.now(),
      lastSeen: Date.now(),
      shutdownReason: null,
    };
    agents.set(agentId, agent);
    return { ...agent };
  }

  function getStatus(agentId) {
    const agent = agents.get(agentId);
    if (!agent) return null;
    return { ...agent };
  }

  function heartbeat(agentId) {
    const agent = agents.get(agentId);
    if (!agent) return false;
    agent.lastSeen = Date.now();
    return true;
  }

  function shutdown(agentId, { reason = 'manual' } = {}) {
    const agent = agents.get(agentId);
    if (!agent) return false;
    agent.status = 'stopped';
    agent.shutdownReason = reason;
    agent.stoppedAt = Date.now();
    return true;
  }

  function listAgents({ status: filterStatus } = {}) {
    let list = [...agents.values()];
    if (filterStatus) list = list.filter(a => a.status === filterStatus);
    return list.map(a => ({ ...a }));
  }

  return { spawn, getStatus, heartbeat, shutdown, listAgents };
}
