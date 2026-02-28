/**
 * Probability Distribution — discrete probability distribution.
 */
export function createDistribution(outcomes) {
  const entries = Object.entries(outcomes);
  function totalProbability() { return entries.reduce((s, [, p]) => s + p, 0); }
  function sample() {
    let r = Math.random();
    for (const [name, prob] of entries) { r -= prob; if (r <= 0) return name; }
    return entries[entries.length - 1][0];
  }
  function probability(outcome) { return outcomes[outcome] || 0; }
  return { totalProbability, sample, probability };
}
