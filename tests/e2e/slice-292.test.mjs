import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 292 — PCA Reducer + SVD Decomposer\x1b[0m\n');
console.log('\x1b[36m  Part 1: PCA Reducer\x1b[0m');
test('pca-reducer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/pca-reducer.mjs')));
const { pcaReduce } = await import('../../tools/ogu/commands/lib/pca-reducer.mjs');
test('reduce dimensions', () => { const data = [[1,2,3],[4,5,6],[7,8,9]]; const r = pcaReduce(data, 2); assert.equal(r.length, 3); assert.equal(r[0].length, 2); });

console.log('\n\x1b[36m  Part 2: SVD Decomposer\x1b[0m');
test('svd-decomposer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/svd-decomposer.mjs')));
const { svdDecompose } = await import('../../tools/ogu/commands/lib/svd-decomposer.mjs');
test('decompose returns U, S, V', () => { const r = svdDecompose([[1,0],[0,1]]); assert.ok(r.U); assert.ok(r.S); assert.ok(r.V); });
test('S values are non-negative', () => { const r = svdDecompose([[3,0],[0,4]]); assert.ok(r.S.every(v => v >= 0)); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
