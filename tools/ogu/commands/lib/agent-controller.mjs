/**
 * Agent Controller — start/stop/pause/resume agent execution lifecycle.
 */

export const AGENT_STATES = ['idle', 'running', 'paused', 'stopped', 'failed'];

const VALID_TRANSITIONS = {
  idle:    ['running'],
  running: ['paused', 'stopped', 'failed'],
  paused:  ['running', 'stopped'],
  stopped: [],
  failed:  ['running'], // can restart after failure
};

/**
 * Create an agent controller.
 *
 * @returns {object} Controller with register/start/stop/pause/resume/getStatus/listAgents
 */
export function createAgentController() {
  const agents = new Map(); // id → { id, role, state, startedAt, stoppedAt }

  function register(id, { role }) {
    agents.set(id, {
      id,
      role,
      state: 'idle',
      startedAt: null,
      stoppedAt: null,
    });
  }

  function transition(id, toState) {
    const agent = agents.get(id);
    if (!agent) throw new Error(`Agent ${id} not found`);
    const allowed = VALID_TRANSITIONS[agent.state];
    if (!allowed || !allowed.includes(toState)) {
      throw new Error(`Invalid transition: ${agent.state} → ${toState}`);
    }
    agent.state = toState;
    return agent;
  }

  function start(id) {
    const agent = transition(id, 'running');
    agent.startedAt = new Date().toISOString();
    return agent;
  }

  function stop(id) {
    const agent = transition(id, 'stopped');
    agent.stoppedAt = new Date().toISOString();
    return agent;
  }

  function pause(id) {
    return transition(id, 'paused');
  }

  function resume(id) {
    return transition(id, 'running');
  }

  function fail(id) {
    return transition(id, 'failed');
  }

  function getStatus(id) {
    const agent = agents.get(id);
    if (!agent) return null;
    return { ...agent };
  }

  function listAgents() {
    return Array.from(agents.values()).map(a => ({ ...a }));
  }

  return { register, start, stop, pause, resume, fail, getStatus, listAgents };
}
