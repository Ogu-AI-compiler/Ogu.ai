import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 300 — Statistics Calculator + Histogram Builder\x1b[0m\n');
console.log('\x1b[36m  Part 1: Statistics Calculator\x1b[0m');
test('statistics-calculator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/statistics-calculator.mjs')));
const { mean, median, stddev, percentile } = await import('../../tools/ogu/commands/lib/statistics-calculator.mjs');
test('mean calculation', () => assert.equal(mean([1,2,3,4,5]), 3));
test('median odd', () => assert.equal(median([3,1,2]), 2));
test('stddev calculation', () => assert.ok(stddev([2,4,4,4,5,5,7,9]) > 0));

console.log('\n\x1b[36m  Part 2: Histogram Builder\x1b[0m');
test('histogram-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/histogram-builder.mjs')));
const { createHistogram } = await import('../../tools/ogu/commands/lib/histogram-builder.mjs');
test('build histogram', () => { const h = createHistogram(3); h.addAll([1,2,3,4,5,6,7,8,9]); const bins = h.getBins(); assert.equal(bins.length, 3); });
test('getCount returns total', () => { const h = createHistogram(2); h.addAll([1,2,3]); assert.equal(h.getCount(), 3); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
