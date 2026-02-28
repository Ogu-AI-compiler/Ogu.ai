/**
 * Pipeline Stage — staged instruction pipeline.
 */
export function createPipeline() {
  const stages = [];
  function addStage(name, fn) { stages.push({ name, fn }); }
  function execute(data) {
    let result = data;
    for (const stage of stages) result = stage.fn(result);
    return result;
  }
  function getStages() { return stages.map(s => s.name); }
  return { addStage, execute, getStages };
}
