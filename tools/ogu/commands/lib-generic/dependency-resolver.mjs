/**
 * Dependency Resolver — resolve dependencies with conflict detection.
 */

export function createDependencyResolver() {
  const deps = new Map(); // node → [dependencies]

  function addDependency(node, dependency) {
    if (!deps.has(node)) deps.set(node, []);
    deps.get(node).push(dependency);
  }

  function resolve(node) {
    const visited = new Set();
    const stack = new Set();
    const order = [];

    function dfs(n) {
      if (stack.has(n)) return true; // circular
      if (visited.has(n)) return false;

      stack.add(n);
      visited.add(n);

      for (const dep of (deps.get(n) || [])) {
        if (dfs(dep)) return true;
      }

      stack.delete(n);
      order.push(n);
      return false;
    }

    const isCircular = dfs(node);
    if (isCircular) {
      return { circular: true, order: [] };
    }

    return { circular: false, order };
  }

  return { addDependency, resolve };
}
