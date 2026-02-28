import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 291 — Feature Scaler + Normalizer\x1b[0m\n');
console.log('\x1b[36m  Part 1: Feature Scaler\x1b[0m');
test('feature-scaler.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/feature-scaler.mjs')));
const { minMaxScale, standardScale } = await import('../../tools/ogu/commands/lib/feature-scaler.mjs');
test('minMaxScale to [0,1]', () => { const r = minMaxScale([1,2,3,4,5]); assert.ok(Math.abs(r[0]) < 0.01); assert.ok(Math.abs(r[4] - 1) < 0.01); });
test('standardScale mean≈0', () => { const r = standardScale([10,20,30,40,50]); const mean = r.reduce((a,b)=>a+b,0)/r.length; assert.ok(Math.abs(mean) < 0.01); });

console.log('\n\x1b[36m  Part 2: Normalizer\x1b[0m');
test('normalizer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/normalizer.mjs')));
const { l2Normalize, l1Normalize } = await import('../../tools/ogu/commands/lib/normalizer.mjs');
test('l2Normalize unit vector', () => { const r = l2Normalize([3,4]); assert.ok(Math.abs(Math.sqrt(r[0]**2+r[1]**2) - 1) < 0.01); });
test('l1Normalize sums to 1', () => { const r = l1Normalize([2,3,5]); assert.ok(Math.abs(r.reduce((a,b)=>a+b,0) - 1) < 0.01); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
