/**
 * Projection Builder — build materialized views from events.
 */

export function createProjectionBuilder() {
  const handlers = new Map();
  let state = {};

  function addHandler(eventType, fn) {
    handlers.set(eventType, fn);
  }

  function project(events) {
    for (const event of events) {
      const handler = handlers.get(event.type);
      if (handler) {
        state = handler(state, event.data);
      }
    }
  }

  function getState() {
    return { ...state };
  }

  function reset() {
    state = {};
  }

  return { addHandler, project, getState, reset };
}
