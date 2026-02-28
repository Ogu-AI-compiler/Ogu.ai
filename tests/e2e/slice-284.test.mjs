import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 284 — Particle Swarm + Swarm Optimizer\x1b[0m\n');

console.log('\x1b[36m  Part 1: Particle Swarm\x1b[0m');
test('particle-swarm.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/particle-swarm.mjs'));
});

const { createParticleSwarm } = await import('../../tools/ogu/commands/lib/particle-swarm.mjs');

test('optimize finds minimum', () => {
  const pso = createParticleSwarm({
    dimensions: 1,
    particles: 10,
    fitness: (pos) => pos[0] * pos[0],
    bounds: [[-10, 10]]
  });
  pso.iterate(20);
  const best = pso.getBest();
  assert.ok(Math.abs(best.position[0]) < 5);
});

test('getIteration tracks count', () => {
  const pso = createParticleSwarm({
    dimensions: 1, particles: 5,
    fitness: (p) => p[0], bounds: [[-1, 1]]
  });
  pso.iterate(3);
  assert.equal(pso.getIteration(), 3);
});

console.log('\n\x1b[36m  Part 2: Swarm Optimizer\x1b[0m');
test('swarm-optimizer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/swarm-optimizer.mjs'));
});

const { createSwarmOptimizer } = await import('../../tools/ogu/commands/lib/swarm-optimizer.mjs');

test('optimize returns best solution', () => {
  const so = createSwarmOptimizer({
    evaluate: (x) => -((x - 3) * (x - 3)),
    generate: () => Math.random() * 10,
    mutate: (x) => x + (Math.random() - 0.5),
    populationSize: 10
  });
  so.run(20);
  const best = so.getBest();
  assert.ok(typeof best.score === 'number');
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
