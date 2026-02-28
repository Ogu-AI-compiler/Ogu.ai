/**
 * Weighted Balancer — distribute load with weighted round-robin.
 */
export function createWeightedBalancer() {
  const targets = [];
  let index = 0;
  function addTarget(id, weight = 1) { targets.push({ id, weight, currentWeight: 0 }); }
  function removeTarget(id) {
    const idx = targets.findIndex(t => t.id === id);
    if (idx >= 0) targets.splice(idx, 1);
  }
  function next() {
    if (targets.length === 0) return null;
    // Weighted round-robin: increment current weights, pick highest
    let totalWeight = 0;
    for (const t of targets) { t.currentWeight += t.weight; totalWeight += t.weight; }
    let best = targets[0];
    for (const t of targets) { if (t.currentWeight > best.currentWeight) best = t; }
    best.currentWeight -= totalWeight;
    return best.id;
  }
  function list() { return targets.map(t => ({ id: t.id, weight: t.weight })); }
  return { addTarget, removeTarget, next, list };
}
