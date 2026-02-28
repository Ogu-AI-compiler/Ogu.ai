/**
 * Data Pipeline Builder — build data transformation pipelines.
 */
export function createDataPipelineBuilder() {
  const steps = [];
  function addStep(name, fn) { steps.push({ name, fn }); return api; }
  function filter(predicate) { return addStep('filter', data => data.filter(predicate)); }
  function map(transform) { return addStep('map', data => data.map(transform)); }
  function reduce(fn, initial) { return addStep('reduce', data => [data.reduce(fn, initial)]); }
  function execute(data) {
    let result = data;
    for (const step of steps) result = step.fn(result);
    return result;
  }
  function listSteps() { return steps.map(s => s.name); }
  const api = { addStep, filter, map, reduce, execute, listSteps };
  return api;
}
