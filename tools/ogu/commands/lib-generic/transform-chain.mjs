/**
 * Transform Chain — chain data transformations with error handling.
 */
export function createTransformChain() {
  const transforms = [];
  function add(name, fn) { transforms.push({ name, fn }); }
  function execute(input) {
    let result = input;
    const log = [];
    for (const t of transforms) {
      try {
        result = t.fn(result);
        log.push({ step: t.name, status: 'ok' });
      } catch (e) {
        log.push({ step: t.name, status: 'error', message: e.message });
        throw e;
      }
    }
    return { result, log };
  }
  function listTransforms() { return transforms.map(t => t.name); }
  function clear() { transforms.length = 0; }
  return { add, execute, listTransforms, clear };
}
