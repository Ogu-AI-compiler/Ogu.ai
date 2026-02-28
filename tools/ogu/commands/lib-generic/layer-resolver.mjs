/**
 * Layer Resolver — resolve layered architecture dependencies.
 */
export function createLayerResolver() {
  const layers = [];
  const layerMap = new Map();
  function addLayer(name, allowedDeps = []) {
    layers.push(name);
    layerMap.set(name, new Set(allowedDeps));
  }
  function canDepend(fromLayer, toLayer) {
    const allowed = layerMap.get(fromLayer);
    if (!allowed) return false;
    return allowed.has(toLayer);
  }
  function validate(dependencies) {
    const violations = [];
    for (const { from, to } of dependencies) {
      if (!canDepend(from, to)) violations.push({ from, to });
    }
    return { valid: violations.length === 0, violations };
  }
  function getLayers() { return [...layers]; }
  return { addLayer, canDepend, validate, getLayers };
}
