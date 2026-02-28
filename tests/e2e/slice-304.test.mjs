import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 304 — Gradient Descent + Optimizer Adam\x1b[0m\n');
console.log('\x1b[36m  Part 1: Gradient Descent\x1b[0m');
test('gradient-descent.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/gradient-descent.mjs')));
const { gradientDescent } = await import('../../tools/ogu/commands/lib/gradient-descent.mjs');
test('minimize x^2', () => { const r = gradientDescent(x => 2*x, 10, 0.1, 100); assert.ok(Math.abs(r) < 1); });

console.log('\n\x1b[36m  Part 2: Optimizer Adam\x1b[0m');
test('optimizer-adam.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/optimizer-adam.mjs')));
const { createAdam } = await import('../../tools/ogu/commands/lib/optimizer-adam.mjs');
test('Adam converges', () => { const adam = createAdam({ lr: 0.5 }); let x = 10; for (let i = 0; i < 200; i++) { x = adam.step(x, 2*x); } assert.ok(Math.abs(x) < 5, `x=${x}`); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
