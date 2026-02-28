import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 299 — Probability Distribution + Random Variable\x1b[0m\n');
console.log('\x1b[36m  Part 1: Probability Distribution\x1b[0m');
test('probability-distribution.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/probability-distribution.mjs')));
const { createDistribution } = await import('../../tools/ogu/commands/lib/probability-distribution.mjs');
test('probabilities sum to 1', () => { const d = createDistribution({ a: 0.3, b: 0.7 }); assert.ok(Math.abs(d.totalProbability() - 1) < 0.01); });
test('sample returns valid outcome', () => { const d = createDistribution({ x: 0.5, y: 0.5 }); const s = d.sample(); assert.ok(s === 'x' || s === 'y'); });

console.log('\n\x1b[36m  Part 2: Random Variable\x1b[0m');
test('random-variable.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/random-variable.mjs')));
const { createRandomVariable } = await import('../../tools/ogu/commands/lib/random-variable.mjs');
test('expected value', () => { const rv = createRandomVariable([{value:1,prob:0.5},{value:3,prob:0.5}]); assert.equal(rv.expectedValue(), 2); });
test('variance', () => { const rv = createRandomVariable([{value:1,prob:0.5},{value:3,prob:0.5}]); assert.equal(rv.variance(), 1); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
