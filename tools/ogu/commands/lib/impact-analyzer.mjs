/**
 * Impact Analyzer — analyze impact of changes across the codebase.
 */

/**
 * Create an impact analyzer.
 *
 * @returns {object} Analyzer with addDependency/analyzeImpact/getImpactScore/listAllDependencies
 */
export function createImpactAnalyzer() {
  const dependents = new Map(); // file → Set of files that depend on it

  function addDependency(source, target) {
    // source depends on target... so source is a dependent of target's modules
    // Actually: "source" imports "target" means target's dependents include source
    // But for impact: if "source" changes, what is affected?
    // We model: source → target means "target depends on source"
    if (!dependents.has(source)) dependents.set(source, new Set());
    dependents.get(source).add(target);
  }

  function analyzeImpact(file) {
    const direct = dependents.get(file);
    const directDependents = direct ? Array.from(direct) : [];

    // Transitive dependents (BFS)
    const visited = new Set();
    const queue = [...directDependents];
    const transitiveDependents = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);

      const next = dependents.get(current);
      if (next) {
        for (const n of next) {
          if (!visited.has(n) && !directDependents.includes(n)) {
            transitiveDependents.push(n);
          }
          queue.push(n);
        }
      }
    }

    return {
      file,
      directDependents,
      transitiveDependents,
      totalAffected: directDependents.length + transitiveDependents.length,
    };
  }

  function getImpactScore(file) {
    const impact = analyzeImpact(file);
    return impact.totalAffected + 1; // +1 for the file itself
  }

  function listAllDependencies() {
    const result = [];
    for (const [source, targets] of dependents) {
      for (const target of targets) {
        result.push({ source, target });
      }
    }
    return result;
  }

  return { addDependency, analyzeImpact, getImpactScore, listAllDependencies };
}
