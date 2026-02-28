import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 279 — Cellular Automaton + Decision Table\x1b[0m\n');

console.log('\x1b[36m  Part 1: Cellular Automaton\x1b[0m');
test('cellular-automaton.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/cellular-automaton.mjs'));
});

const { createCellularAutomaton } = await import('../../tools/ogu/commands/lib/cellular-automaton.mjs');

test('step evolves state', () => {
  const ca = createCellularAutomaton([0, 1, 0, 1, 1], (left, center, right) => (left + center + right) % 2);
  ca.step();
  const state = ca.getState();
  assert.equal(state.length, 5);
});

test('getGeneration tracks steps', () => {
  const ca = createCellularAutomaton([1, 0, 1], () => 0);
  ca.step(); ca.step();
  assert.equal(ca.getGeneration(), 2);
});

console.log('\n\x1b[36m  Part 2: Decision Table\x1b[0m');
test('decision-table.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/decision-table.mjs'));
});

const { createDecisionTable } = await import('../../tools/ogu/commands/lib/decision-table.mjs');

test('match rule and get action', () => {
  const dt = createDecisionTable();
  dt.addRule({ age: 'adult', income: 'high' }, 'approve');
  dt.addRule({ age: 'minor', income: 'any' }, 'reject');
  assert.equal(dt.evaluate({ age: 'adult', income: 'high' }), 'approve');
});

test('no match returns default', () => {
  const dt = createDecisionTable('unknown');
  dt.addRule({ status: 'active' }, 'ok');
  assert.equal(dt.evaluate({ status: 'inactive' }), 'unknown');
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
