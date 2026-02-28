/**
 * State Sync Client — client-side state replica with sync cursors.
 *
 * Applies events to build a local state snapshot, tracks position
 * via cursor for reconnection and replay.
 */

const EVENT_REDUCERS = {
  'dag.updated': (state, data) => {
    if (!state.dag) state.dag = {};
    state.dag[data.phase || 'default'] = data;
  },
  'budget.updated': (state, data) => {
    if (!state.budget) state.budget = {};
    state.budget[data.role || 'default'] = data;
  },
  'agent.updated': (state, data) => {
    if (!state.agents) state.agents = {};
    state.agents[data.agentId] = data;
  },
  'task.started': (state, data) => {
    if (!state.tasks) state.tasks = {};
    state.tasks[data.taskId] = { ...data, status: 'running' };
  },
  'task.completed': (state, data) => {
    if (!state.tasks) state.tasks = {};
    state.tasks[data.taskId] = { ...data, status: 'completed' };
  },
  'governance.alert': (state, data) => {
    if (!state.governance) state.governance = { alerts: [] };
    state.governance.alerts.push(data);
  },
};

/**
 * Create a state sync client.
 *
 * @param {object} opts - { clientId }
 * @returns {object} Client with applyEvent/applyEvents/getState/getCursor/reset
 */
export function createStateSyncClient({ clientId }) {
  let state = {};
  let cursor = 0;

  function applyEvent(event) {
    const reducer = EVENT_REDUCERS[event.type];
    if (reducer) {
      reducer(state, event.data);
    }
    if (event.seq > cursor) {
      cursor = event.seq;
    }
  }

  function applyEvents(events) {
    for (const event of events) {
      applyEvent(event);
    }
  }

  function getState() {
    return { ...state };
  }

  function getCursor() {
    return cursor;
  }

  function reset() {
    state = {};
    cursor = 0;
  }

  return { applyEvent, applyEvents, getState, getCursor, reset, clientId };
}
