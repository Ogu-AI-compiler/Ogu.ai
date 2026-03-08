/**
 * Event Projector — project events into materialized state.
 */
export function createEventProjector(initialState) {
  let state = { ...initialState };
  const handlers = new Map();
  const events = [];
  function on(type, handler) { handlers.set(type, handler); }
  function apply(event) {
    events.push(event);
    const h = handlers.get(event.type);
    if (h) state = h(state, event);
  }
  function getState() { return { ...state }; }
  function getEvents() { return [...events]; }
  return { on, apply, getState, getEvents };
}
