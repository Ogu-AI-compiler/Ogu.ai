import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 305 — Loss Function + Cross Entropy\x1b[0m\n');
console.log('\x1b[36m  Part 1: Loss Function\x1b[0m');
test('loss-function.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/loss-function.mjs')));
const { mse, mae } = await import('../../tools/ogu/commands/lib/loss-function.mjs');
test('MSE calculation', () => assert.equal(mse([1,2,3],[1,2,3]), 0));
test('MAE calculation', () => assert.equal(mae([1,2,3],[2,3,4]), 1));

console.log('\n\x1b[36m  Part 2: Cross Entropy\x1b[0m');
test('cross-entropy.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/cross-entropy.mjs')));
const { binaryCrossEntropy, categoricalCrossEntropy } = await import('../../tools/ogu/commands/lib/cross-entropy.mjs');
test('binary cross entropy', () => { const r = binaryCrossEntropy([1,0,1],[0.9,0.1,0.8]); assert.ok(r > 0 && r < 1); });
test('categorical cross entropy', () => { const r = categoricalCrossEntropy([1,0,0],[0.7,0.2,0.1]); assert.ok(r > 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
