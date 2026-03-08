/**
 * Genetic Algorithm — evolutionary optimization.
 */
export function createGeneticAlgorithm({ populationSize, geneLength, fitness, mutationRate }) {
  let population = Array.from({ length: populationSize }, () =>
    Array.from({ length: geneLength }, () => Math.random())
  );
  let generation = 0;

  function evaluateAll() {
    return population.map(genes => ({ genes, fitness: fitness(genes) }))
      .sort((a, b) => b.fitness - a.fitness);
  }

  function evolve(generations) {
    for (let g = 0; g < generations; g++) {
      const evaluated = evaluateAll();
      const newPop = [evaluated[0].genes];
      while (newPop.length < populationSize) {
        const p1 = evaluated[Math.floor(Math.random() * Math.floor(populationSize / 2))].genes;
        const p2 = evaluated[Math.floor(Math.random() * Math.floor(populationSize / 2))].genes;
        const crossover = Math.floor(Math.random() * geneLength);
        const child = [...p1.slice(0, crossover), ...p2.slice(crossover)];
        for (let i = 0; i < geneLength; i++) {
          if (Math.random() < mutationRate) child[i] = Math.random();
        }
        newPop.push(child);
      }
      population = newPop;
      generation++;
    }
  }

  function getBestFitness() { return evaluateAll()[0].fitness; }
  function getBest() { return [...evaluateAll()[0].genes]; }
  function getGeneration() { return generation; }
  return { evolve, getBestFitness, getBest, getGeneration };
}
