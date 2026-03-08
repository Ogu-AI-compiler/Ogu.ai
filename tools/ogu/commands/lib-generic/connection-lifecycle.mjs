/**
 * Connection Lifecycle — track connection state transitions.
 */

const VALID_TRANSITIONS = {
  created: ["active", "closed"],
  active: ["idle", "closed"],
  idle: ["active", "closed"],
  closed: [],
};

export function createConnectionLifecycle() {
  const connections = new Map(); // id → { state, history }

  function create(id) {
    const entry = {
      state: "created",
      history: [{ state: "created", at: Date.now() }],
    };
    connections.set(id, entry);
    return id;
  }

  function transition(id, newState) {
    const entry = connections.get(id);
    if (!entry) throw new Error(`Unknown connection: ${id}`);
    const allowed = VALID_TRANSITIONS[entry.state] || [];
    if (!allowed.includes(newState)) {
      throw new Error(`Invalid transition: ${entry.state} → ${newState}`);
    }
    entry.state = newState;
    entry.history.push({ state: newState, at: Date.now() });
  }

  function getState(id) {
    const entry = connections.get(id);
    if (!entry) throw new Error(`Unknown connection: ${id}`);
    return entry.state;
  }

  function getHistory(id) {
    const entry = connections.get(id);
    if (!entry) throw new Error(`Unknown connection: ${id}`);
    return [...entry.history];
  }

  return { create, transition, getState, getHistory };
}
