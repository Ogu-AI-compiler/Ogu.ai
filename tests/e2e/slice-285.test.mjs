import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 285 — Simulated Annealing + Cooling Schedule\x1b[0m\n');

console.log('\x1b[36m  Part 1: Simulated Annealing\x1b[0m');
test('simulated-annealing.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/simulated-annealing.mjs'));
});

const { createSimulatedAnnealing } = await import('../../tools/ogu/commands/lib/simulated-annealing.mjs');

test('optimize finds near-optimal', () => {
  const sa = createSimulatedAnnealing({
    initial: 10,
    neighbor: (x) => x + (Math.random() - 0.5) * 2,
    energy: (x) => (x - 3) * (x - 3),
    temperature: 100,
    coolingRate: 0.95
  });
  sa.run(200);
  const best = sa.getBest();
  assert.ok(Math.abs(best.solution - 3) < 5);
});

test('getStats reports iterations', () => {
  const sa = createSimulatedAnnealing({
    initial: 0, neighbor: (x) => x + 1, energy: (x) => x * x,
    temperature: 10, coolingRate: 0.9
  });
  sa.run(10);
  assert.equal(sa.getStats().iterations, 10);
});

console.log('\n\x1b[36m  Part 2: Cooling Schedule\x1b[0m');
test('cooling-schedule.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/cooling-schedule.mjs'));
});

const { linearCooling, exponentialCooling, logarithmicCooling } = await import('../../tools/ogu/commands/lib/cooling-schedule.mjs');

test('linear cooling decreases', () => {
  const t0 = linearCooling(100, 0, 200);
  const t100 = linearCooling(100, 100, 200);
  assert.ok(t100 < t0);
});

test('exponential cooling decreases', () => {
  const t0 = exponentialCooling(100, 0, 0.95);
  const t10 = exponentialCooling(100, 10, 0.95);
  assert.ok(t10 < t0);
});

test('logarithmic cooling decreases', () => {
  const t1 = logarithmicCooling(100, 1);
  const t10 = logarithmicCooling(100, 10);
  assert.ok(t10 < t1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
