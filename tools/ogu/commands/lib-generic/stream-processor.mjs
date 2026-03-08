/**
 * Stream Processor — process streams with transforms and buffering.
 */

export function createStreamProcessor() {
  const transforms = [];
  const output = [];
  let processed = 0;

  function addTransform(fn) {
    transforms.push(fn);
  }

  function push(item) {
    processed++;
    let value = item;
    for (const fn of transforms) {
      value = fn(value);
      if (value === null || value === undefined) return;
    }
    output.push(value);
  }

  function getOutput() {
    return [...output];
  }

  function getStats() {
    return {
      processed,
      outputCount: output.length,
      transformCount: transforms.length,
    };
  }

  return { addTransform, push, getOutput, getStats };
}
