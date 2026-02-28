import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 281 — Neural Network Layer + Activation Functions\x1b[0m\n');

console.log('\x1b[36m  Part 1: Neural Network Layer\x1b[0m');
test('neural-network-layer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/neural-network-layer.mjs'));
});

const { createLayer } = await import('../../tools/ogu/commands/lib/neural-network-layer.mjs');

test('forward computes output', () => {
  const layer = createLayer(2, 1, () => ({ weights: [[0.5, 0.5]], biases: [0] }));
  const output = layer.forward([1, 1]);
  assert.equal(output.length, 1);
  assert.ok(Math.abs(output[0] - 1.0) < 0.01);
});

test('getWeights returns weights', () => {
  const layer = createLayer(3, 2, () => ({ weights: [[1,0,0],[0,1,0]], biases: [0,0] }));
  const w = layer.getWeights();
  assert.equal(w.weights.length, 2);
});

console.log('\n\x1b[36m  Part 2: Activation Functions\x1b[0m');
test('activation-functions.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/activation-functions.mjs'));
});

const { sigmoid, relu, tanh: tanhFn } = await import('../../tools/ogu/commands/lib/activation-functions.mjs');

test('sigmoid output range [0,1]', () => {
  assert.ok(sigmoid(0) > 0.49 && sigmoid(0) < 0.51);
  assert.ok(sigmoid(100) > 0.99);
  assert.ok(sigmoid(-100) < 0.01);
});

test('relu clips negatives', () => {
  assert.equal(relu(-5), 0);
  assert.equal(relu(3), 3);
});

test('tanh output range [-1,1]', () => {
  assert.ok(tanhFn(0) < 0.01 && tanhFn(0) > -0.01);
  assert.ok(tanhFn(100) > 0.99);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
