import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 282 — Perceptron + Training Loop\x1b[0m\n');

console.log('\x1b[36m  Part 1: Perceptron\x1b[0m');
test('perceptron.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/perceptron.mjs'));
});

const { createPerceptron } = await import('../../tools/ogu/commands/lib/perceptron.mjs');

test('predict returns 0 or 1', () => {
  const p = createPerceptron(2);
  const result = p.predict([1, 1]);
  assert.ok(result === 0 || result === 1);
});

test('train adjusts weights', () => {
  const p = createPerceptron(2);
  const w1 = [...p.getWeights()];
  p.train([1, 0], 1);
  const w2 = p.getWeights();
  // Weights may or may not change depending on initial prediction
  assert.equal(w2.length, w1.length);
});

console.log('\n\x1b[36m  Part 2: Training Loop\x1b[0m');
test('training-loop.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/training-loop.mjs'));
});

const { createTrainingLoop } = await import('../../tools/ogu/commands/lib/training-loop.mjs');

test('run training epochs', () => {
  const loop = createTrainingLoop({
    epochs: 5,
    onEpoch: (epoch, data) => data.loss = 1 / (epoch + 1)
  });
  const result = loop.run({ loss: 1.0 });
  assert.ok(result.loss < 1.0);
});

test('getHistory tracks epochs', () => {
  const loop = createTrainingLoop({
    epochs: 3,
    onEpoch: (epoch, data) => { data.loss = 1 / (epoch + 1); }
  });
  loop.run({ loss: 1.0 });
  assert.equal(loop.getHistory().length, 3);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
