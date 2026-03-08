/**
 * Swarm Optimizer — generic population-based optimizer.
 */
export function createSwarmOptimizer({ evaluate, generate, mutate, populationSize }) {
  let population = Array.from({ length: populationSize }, generate);
  let best = { solution: null, score: -Infinity };

  function run(iterations) {
    for (let i = 0; i < iterations; i++) {
      const scored = population.map(s => ({ solution: s, score: evaluate(s) }));
      scored.sort((a, b) => b.score - a.score);
      if (scored[0].score > best.score) best = { ...scored[0] };
      const survivors = scored.slice(0, Math.ceil(populationSize / 2)).map(s => s.solution);
      population = survivors.concat(survivors.map(s => mutate(s)));
      while (population.length < populationSize) population.push(generate());
    }
  }

  function getBest() { return { ...best }; }
  return { run, getBest };
}
