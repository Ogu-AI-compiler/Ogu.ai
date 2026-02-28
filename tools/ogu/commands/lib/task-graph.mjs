/**
 * Task Graph — DAG of tasks with topological sort and cycle detection.
 */
export function createTaskGraph() {
  const tasks = new Set();
  const deps = new Map();
  function addTask(id) { tasks.add(id); if (!deps.has(id)) deps.set(id, []); }
  function addDependency(task, dependsOn) {
    if (!deps.has(task)) deps.set(task, []);
    deps.get(task).push(dependsOn);
  }
  function getDependencies(task) { return deps.get(task) || []; }
  function topoSort() {
    const visited = new Set(), result = [];
    function visit(node) {
      if (visited.has(node)) return;
      visited.add(node);
      for (const d of (deps.get(node) || [])) visit(d);
      result.push(node);
    }
    for (const t of tasks) visit(t);
    return result;
  }
  function hasCycle() {
    const white = new Set(tasks), gray = new Set();
    function dfs(node) {
      white.delete(node); gray.add(node);
      for (const d of (deps.get(node) || [])) {
        if (gray.has(d)) return true;
        if (white.has(d) && dfs(d)) return true;
      }
      gray.delete(node);
      return false;
    }
    for (const t of tasks) { if (white.has(t) && dfs(t)) return true; }
    return false;
  }
  return { addTask, addDependency, getDependencies, topoSort, hasCycle };
}
