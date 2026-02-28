/**
 * Extension Registry — register extension points for plugin integration.
 */

/**
 * Create an extension registry.
 *
 * @returns {object} Registry with definePoint/extend/getExtensions/executePoint/listPoints
 */
export function createExtensionRegistry() {
  const points = new Map(); // name → { description, extensions: [] }

  function definePoint({ name, description }) {
    points.set(name, { name, description, extensions: [] });
  }

  function extend(pointName, { name, handler }) {
    const point = points.get(pointName);
    if (!point) throw new Error(`Extension point "${pointName}" not defined`);
    point.extensions.push({ name, handler });
  }

  function getExtensions(pointName) {
    const point = points.get(pointName);
    return point ? [...point.extensions] : [];
  }

  function executePoint(pointName, context) {
    const exts = getExtensions(pointName);
    const results = [];
    for (const ext of exts) {
      results.push(ext.handler(context));
    }
    return results;
  }

  function listPoints() {
    return Array.from(points.values()).map(({ name, description, extensions }) => ({
      name, description, extensionCount: extensions.length,
    }));
  }

  return { definePoint, extend, getExtensions, executePoint, listPoints };
}
