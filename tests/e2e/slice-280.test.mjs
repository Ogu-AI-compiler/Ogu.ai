import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 280 — Condition Evaluator + Rule Evaluator\x1b[0m\n');

console.log('\x1b[36m  Part 1: Condition Evaluator\x1b[0m');
test('condition-evaluator.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/condition-evaluator.mjs'));
});

const { evaluateCondition } = await import('../../tools/ogu/commands/lib/condition-evaluator.mjs');

test('evaluate equals', () => {
  assert.ok(evaluateCondition({ field: 'status', op: 'eq', value: 'active' }, { status: 'active' }));
});

test('evaluate greater than', () => {
  assert.ok(evaluateCondition({ field: 'age', op: 'gt', value: 18 }, { age: 25 }));
  assert.ok(!evaluateCondition({ field: 'age', op: 'gt', value: 18 }, { age: 10 }));
});

test('evaluate contains', () => {
  assert.ok(evaluateCondition({ field: 'name', op: 'contains', value: 'li' }, { name: 'Alice' }));
});

console.log('\n\x1b[36m  Part 2: Rule Evaluator\x1b[0m');
test('rule-evaluator.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/rule-evaluator.mjs'));
});

const { createRuleEvaluator } = await import('../../tools/ogu/commands/lib/rule-evaluator.mjs');

test('evaluate rule with all conditions', () => {
  const re = createRuleEvaluator();
  re.addRule('premium', [
    { field: 'age', op: 'gt', value: 18 },
    { field: 'income', op: 'gt', value: 50000 }
  ]);
  assert.ok(re.evaluate('premium', { age: 25, income: 100000 }));
  assert.ok(!re.evaluate('premium', { age: 15, income: 100000 }));
});

test('list rules', () => {
  const re = createRuleEvaluator();
  re.addRule('a', []);
  re.addRule('b', []);
  assert.equal(re.listRules().length, 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
