import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 296 — Knapsack Solver + Coin Change Solver\x1b[0m\n');
console.log('\x1b[36m  Part 1: Knapsack Solver\x1b[0m');
test('knapsack-solver.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/knapsack-solver.mjs')));
const { knapsack } = await import('../../tools/ogu/commands/lib/knapsack-solver.mjs');
test('0/1 knapsack optimal value', () => { const r = knapsack([{weight:2,value:3},{weight:3,value:4},{weight:4,value:5}], 5); assert.equal(r.value, 7); });
test('empty items returns 0', () => { const r = knapsack([], 10); assert.equal(r.value, 0); });

console.log('\n\x1b[36m  Part 2: Coin Change Solver\x1b[0m');
test('coin-change-solver.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/coin-change-solver.mjs')));
const { coinChange } = await import('../../tools/ogu/commands/lib/coin-change-solver.mjs');
test('minimum coins for 11', () => assert.equal(coinChange([1,5,10], 11), 2));
test('impossible returns -1', () => assert.equal(coinChange([3], 5), -1));

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
