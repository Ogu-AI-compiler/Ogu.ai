import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 297 — Matrix Chain Multiplier + Optimal BST\x1b[0m\n');
console.log('\x1b[36m  Part 1: Matrix Chain Multiplier\x1b[0m');
test('matrix-chain-multiplier.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/matrix-chain-multiplier.mjs')));
const { matrixChainOrder } = await import('../../tools/ogu/commands/lib/matrix-chain-multiplier.mjs');
test('optimal multiplication cost', () => { const r = matrixChainOrder([10,30,5,60]); assert.equal(r, 4500); });

console.log('\n\x1b[36m  Part 2: Optimal BST\x1b[0m');
test('optimal-bst.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/optimal-bst.mjs')));
const { optimalBSTCost } = await import('../../tools/ogu/commands/lib/optimal-bst.mjs');
test('optimal BST cost', () => { const r = optimalBSTCost([0.1, 0.2, 0.4, 0.3]); assert.ok(r > 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
