/**
 * Config Registry — centralized configuration with layered overrides.
 *
 * Supports base values, named layers, and layer activation/deactivation.
 */

/**
 * Create a config registry.
 *
 * @returns {object} Registry with set/get/getAll/addLayer/activateLayer/deactivateLayer
 */
export function createConfigRegistry() {
  const base = new Map();
  const layers = new Map();         // name → Map<key, value>
  const activeLayers = new Set();

  function set(key, value) {
    base.set(key, value);
  }

  function get(key) {
    // Active layers override base (last activated wins)
    for (const name of activeLayers) {
      const layer = layers.get(name);
      if (layer && layer.has(key)) return layer.get(key);
    }
    return base.get(key);
  }

  function getAll() {
    const result = {};
    for (const [k, v] of base) result[k] = v;
    for (const name of activeLayers) {
      const layer = layers.get(name);
      if (layer) {
        for (const [k, v] of layer) result[k] = v;
      }
    }
    return result;
  }

  function addLayer(name, overrides) {
    const layerMap = new Map();
    for (const [k, v] of Object.entries(overrides)) {
      layerMap.set(k, v);
    }
    layers.set(name, layerMap);
  }

  function activateLayer(name) {
    if (!layers.has(name)) throw new Error(`Layer "${name}" not defined`);
    activeLayers.add(name);
  }

  function deactivateLayer(name) {
    activeLayers.delete(name);
  }

  return { set, get, getAll, addLayer, activateLayer, deactivateLayer };
}
