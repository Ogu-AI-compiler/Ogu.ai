/**
 * A/B Test Router — route users to experiment variants deterministically.
 */

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function createABTestRouter() {
  const experiments = new Map();
  const assignments = new Map(); // experiment → Map<userId, variant>

  function addExperiment({ name, variants, weights }) {
    experiments.set(name, { variants, weights });
    assignments.set(name, new Map());
  }

  function assign(experimentName, userId) {
    const exp = experiments.get(experimentName);
    if (!exp) throw new Error(`Experiment "${experimentName}" not found`);

    const cache = assignments.get(experimentName);
    if (cache.has(userId)) return cache.get(userId);

    const hash = hashString(`${experimentName}:${userId}`);
    const totalWeight = exp.weights.reduce((s, w) => s + w, 0);
    const bucket = hash % totalWeight;

    let cumulative = 0;
    let chosen = exp.variants[0];
    for (let i = 0; i < exp.variants.length; i++) {
      cumulative += exp.weights[i];
      if (bucket < cumulative) { chosen = exp.variants[i]; break; }
    }

    cache.set(userId, chosen);
    return chosen;
  }

  function getResults(experimentName) {
    const cache = assignments.get(experimentName);
    if (!cache) return {};
    const counts = {};
    for (const variant of cache.values()) {
      counts[variant] = (counts[variant] || 0) + 1;
    }
    return counts;
  }

  return { addExperiment, assign, getResults };
}
