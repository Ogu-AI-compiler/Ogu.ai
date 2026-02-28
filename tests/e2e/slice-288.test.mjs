import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 288 — Bayesian Classifier + Naive Bayes\x1b[0m\n');

console.log('\x1b[36m  Part 1: Bayesian Classifier\x1b[0m');
test('bayesian-classifier.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/bayesian-classifier.mjs'));
});

const { createBayesianClassifier } = await import('../../tools/ogu/commands/lib/bayesian-classifier.mjs');

test('train and classify', () => {
  const bc = createBayesianClassifier();
  bc.train('spam', ['buy', 'now', 'free']);
  bc.train('spam', ['win', 'free', 'prize']);
  bc.train('ham', ['hello', 'meeting', 'project']);
  bc.train('ham', ['schedule', 'meeting', 'today']);
  const result = bc.classify(['free', 'buy']);
  assert.equal(result, 'spam');
});

console.log('\n\x1b[36m  Part 2: Naive Bayes\x1b[0m');
test('naive-bayes.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/naive-bayes.mjs'));
});

const { createNaiveBayes } = await import('../../tools/ogu/commands/lib/naive-bayes.mjs');

test('train and predict', () => {
  const nb = createNaiveBayes();
  nb.learn('positive', ['great', 'good', 'amazing']);
  nb.learn('positive', ['wonderful', 'great']);
  nb.learn('negative', ['bad', 'terrible', 'awful']);
  nb.learn('negative', ['horrible', 'bad']);
  assert.equal(nb.predict(['great', 'amazing']), 'positive');
});

test('getCategories returns list', () => {
  const nb = createNaiveBayes();
  nb.learn('a', ['x']); nb.learn('b', ['y']);
  assert.equal(nb.getCategories().length, 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
