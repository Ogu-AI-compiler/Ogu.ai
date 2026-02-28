import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 283 — Genetic Algorithm + Fitness Evaluator\x1b[0m\n');

console.log('\x1b[36m  Part 1: Genetic Algorithm\x1b[0m');
test('genetic-algorithm.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/genetic-algorithm.mjs'));
});

const { createGeneticAlgorithm } = await import('../../tools/ogu/commands/lib/genetic-algorithm.mjs');

test('evolve improves fitness', () => {
  const ga = createGeneticAlgorithm({
    populationSize: 20,
    geneLength: 5,
    fitness: (genes) => genes.reduce((a, b) => a + b, 0),
    mutationRate: 0.1
  });
  const gen0 = ga.getBestFitness();
  ga.evolve(10);
  const gen10 = ga.getBestFitness();
  assert.ok(gen10 >= gen0);
});

test('getGeneration tracks generations', () => {
  const ga = createGeneticAlgorithm({
    populationSize: 10, geneLength: 3,
    fitness: (g) => g[0], mutationRate: 0.1
  });
  ga.evolve(5);
  assert.equal(ga.getGeneration(), 5);
});

console.log('\n\x1b[36m  Part 2: Fitness Evaluator\x1b[0m');
test('fitness-evaluator.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/fitness-evaluator.mjs'));
});

const { createFitnessEvaluator } = await import('../../tools/ogu/commands/lib/fitness-evaluator.mjs');

test('evaluate returns score', () => {
  const fe = createFitnessEvaluator((individual) => individual.length);
  assert.equal(fe.evaluate([1, 2, 3]), 3);
});

test('rank sorts by fitness', () => {
  const fe = createFitnessEvaluator((x) => x);
  const ranked = fe.rank([3, 1, 5, 2]);
  assert.equal(ranked[0].individual, 5);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
