/**
 * Simulated Annealing — probabilistic optimization.
 */
export function createSimulatedAnnealing({ initial, neighbor, energy, temperature, coolingRate }) {
  let current = initial;
  let currentEnergy = energy(current);
  let best = current;
  let bestEnergy = currentEnergy;
  let temp = temperature;
  let iterations = 0;

  function run(n) {
    for (let i = 0; i < n; i++) {
      const candidate = neighbor(current);
      const candidateEnergy = energy(candidate);
      const delta = candidateEnergy - currentEnergy;
      if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
        current = candidate;
        currentEnergy = candidateEnergy;
      }
      if (currentEnergy < bestEnergy) {
        best = current;
        bestEnergy = currentEnergy;
      }
      temp *= coolingRate;
      iterations++;
    }
  }

  function getBest() { return { solution: best, energy: bestEnergy }; }
  function getStats() { return { iterations, temperature: temp }; }
  return { run, getBest, getStats };
}
