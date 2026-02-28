/**
 * Fitness Evaluator — evaluate and rank individuals.
 */
export function createFitnessEvaluator(fitnessFunction) {
  function evaluate(individual) { return fitnessFunction(individual); }
  function rank(individuals) {
    return individuals
      .map(ind => ({ individual: ind, fitness: fitnessFunction(ind) }))
      .sort((a, b) => b.fitness - a.fitness);
  }
  return { evaluate, rank };
}
