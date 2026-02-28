/**
 * Tokenizer Pipeline — chain text processing stages.
 */
export function createTokenizerPipeline() {
  const stages = [];

  function addStage(fn) { stages.push(fn); }

  function run(input) {
    let result = input;
    for (const stage of stages) result = stage(result);
    return result;
  }

  function getStageCount() { return stages.length; }

  return { addStage, run, getStageCount };
}
