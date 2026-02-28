import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 303 — Convolution Engine + Kernel Builder\x1b[0m\n');
console.log('\x1b[36m  Part 1: Convolution Engine\x1b[0m');
test('convolution-engine.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/convolution-engine.mjs')));
const { convolve1d, convolve2d } = await import('../../tools/ogu/commands/lib/convolution-engine.mjs');
test('1D convolution', () => { const r = convolve1d([1,2,3,4], [1,0,-1]); assert.ok(r.length > 0); });
test('2D convolution', () => { const img = [[1,2],[3,4]]; const k = [[1,0],[0,1]]; const r = convolve2d(img, k); assert.ok(r.length > 0); });

console.log('\n\x1b[36m  Part 2: Kernel Builder\x1b[0m');
test('kernel-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/kernel-builder.mjs')));
const { gaussianKernel, sobelX, identity } = await import('../../tools/ogu/commands/lib/kernel-builder.mjs');
test('gaussian kernel 3x3', () => { const k = gaussianKernel(3); assert.equal(k.length, 3); assert.equal(k[0].length, 3); });
test('identity kernel', () => { const k = identity(3); assert.equal(k[1][1], 1); assert.equal(k[0][0], 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
