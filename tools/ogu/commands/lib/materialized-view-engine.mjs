/**
 * Materialized View Engine — maintain derived state from event stream.
 */

/**
 * Create a materialized view engine.
 *
 * @returns {object} Engine with registerView/processEvent/getView/listViews
 */
export function createMaterializedViewEngine() {
  const views = new Map(); // name → { state, reducer }

  function registerView(name, { initialState, reducer }) {
    views.set(name, { state: structuredClone(initialState), reducer });
  }

  function processEvent(event) {
    for (const view of views.values()) {
      view.state = view.reducer(view.state, event);
    }
  }

  function getView(name) {
    const view = views.get(name);
    if (!view) return null;
    return view.state;
  }

  function listViews() {
    return Array.from(views.keys());
  }

  function resetView(name) {
    const view = views.get(name);
    if (view) view.state = structuredClone(view.state);
  }

  return { registerView, processEvent, getView, listViews, resetView };
}
