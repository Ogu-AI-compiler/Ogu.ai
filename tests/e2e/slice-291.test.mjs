import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 291 — Normalizer\x1b[0m\n');
console.log('\x1b[36m  Part 1: Normalizer\x1b[0m');
test('normalizer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/normalizer.mjs')));
const { l2Normalize, l1Normalize } = await import('../../tools/ogu/commands/lib/normalizer.mjs');
test('l2Normalize unit vector', () => { const r = l2Normalize([3,4]); assert.ok(Math.abs(Math.sqrt(r[0]**2+r[1]**2) - 1) < 0.01); });
test('l1Normalize sums to 1', () => { const r = l1Normalize([2,3,5]); assert.ok(Math.abs(r.reduce((a,b)=>a+b,0) - 1) < 0.01); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
