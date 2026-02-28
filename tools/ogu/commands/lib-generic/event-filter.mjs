/**
 * Event Filter — named filters for event streams.
 */
export function createEventFilter() {
  const filters = new Map();
  function addFilter(name, predicate) { filters.set(name, predicate); }
  function apply(name, events) {
    const pred = filters.get(name);
    if (!pred) return events;
    return events.filter(pred);
  }
  function applyAll(names, events) {
    let result = events;
    for (const name of names) result = apply(name, result);
    return result;
  }
  function removeFilter(name) { filters.delete(name); }
  return { addFilter, apply, applyAll, removeFilter };
}
