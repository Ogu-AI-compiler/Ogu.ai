import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 290 — Markov Chain + State Predictor\x1b[0m\n');

console.log('\x1b[36m  Part 1: Markov Chain\x1b[0m');
test('markov-chain.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/markov-chain.mjs'));
});

const { createMarkovChain } = await import('../../tools/ogu/commands/lib/markov-chain.mjs');

test('train and generate', () => {
  const mc = createMarkovChain();
  mc.train(['a', 'b', 'c', 'a', 'b', 'c']);
  const next = mc.predict('a');
  assert.equal(next, 'b');
});

test('getTransitions returns map', () => {
  const mc = createMarkovChain();
  mc.train(['x', 'y', 'x', 'z']);
  const t = mc.getTransitions('x');
  assert.ok(t.y > 0 || t.z > 0);
});

console.log('\n\x1b[36m  Part 2: State Predictor\x1b[0m');
test('state-predictor.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/state-predictor.mjs'));
});

const { createStatePredictor } = await import('../../tools/ogu/commands/lib/state-predictor.mjs');

test('predict next state', () => {
  const sp = createStatePredictor();
  sp.observe('idle'); sp.observe('loading'); sp.observe('idle'); sp.observe('loading');
  assert.equal(sp.predict('idle'), 'loading');
});

test('getConfidence returns value', () => {
  const sp = createStatePredictor();
  sp.observe('a'); sp.observe('b'); sp.observe('a'); sp.observe('b');
  const conf = sp.getConfidence('a');
  assert.ok(conf > 0);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
