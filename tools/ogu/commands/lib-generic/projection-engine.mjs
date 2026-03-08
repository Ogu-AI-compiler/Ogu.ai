/**
 * Projection Engine — build read models from event streams.
 */
export function createProjectionEngine() {
  const projections = new Map();
  function define(name, initialState, reducer) {
    projections.set(name, { state: { ...initialState }, reducer });
  }
  function apply(name, event) {
    const proj = projections.get(name);
    if (!proj) throw new Error(`Projection ${name} not found`);
    proj.state = proj.reducer(proj.state, event);
  }
  function applyAll(name, events) {
    for (const e of events) apply(name, e);
  }
  function getState(name) {
    const proj = projections.get(name);
    return proj ? { ...proj.state } : null;
  }
  function list() { return [...projections.keys()]; }
  return { define, apply, applyAll, getState, list };
}
