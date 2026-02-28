/**
 * Data Transformer — transform data between schema versions.
 *
 * Register named transforms and chain them for multi-version upgrades.
 */

/**
 * Create a data transformer.
 *
 * @returns {object} Transformer with addTransform/transform/chain/listTransforms
 */
export function createDataTransformer() {
  const transforms = new Map();

  function addTransform(name, fn) {
    transforms.set(name, fn);
  }

  function transform(name, data) {
    const fn = transforms.get(name);
    if (!fn) throw new Error(`Unknown transform: ${name}`);
    return fn(data);
  }

  function chain(names, data) {
    let result = data;
    for (const name of names) {
      result = transform(name, result);
    }
    return result;
  }

  function listTransforms() {
    return Array.from(transforms.keys());
  }

  return { addTransform, transform, chain, listTransforms };
}
