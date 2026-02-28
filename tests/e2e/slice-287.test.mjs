import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 287 — Linear Regression + Polynomial Fit\x1b[0m\n');

console.log('\x1b[36m  Part 1: Linear Regression\x1b[0m');
test('linear-regression.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/linear-regression.mjs'));
});

const { linearRegression } = await import('../../tools/ogu/commands/lib/linear-regression.mjs');

test('fit line to data', () => {
  const result = linearRegression([1,2,3,4,5], [2,4,6,8,10]);
  assert.ok(Math.abs(result.slope - 2) < 0.01);
  assert.ok(Math.abs(result.intercept) < 0.01);
});

test('predict returns value', () => {
  const result = linearRegression([1,2,3], [3,5,7]);
  assert.ok(Math.abs(result.predict(4) - 9) < 0.01);
});

console.log('\n\x1b[36m  Part 2: Polynomial Fit\x1b[0m');
test('polynomial-fit.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/polynomial-fit.mjs'));
});

const { polynomialFit } = await import('../../tools/ogu/commands/lib/polynomial-fit.mjs');

test('fit quadratic', () => {
  const result = polynomialFit([0,1,2,3], [0,1,4,9], 2);
  assert.ok(result.coefficients.length === 3);
  const pred = result.predict(2);
  assert.ok(Math.abs(pred - 4) < 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
